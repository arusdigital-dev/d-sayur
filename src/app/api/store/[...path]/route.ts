import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { createSession, deleteSession, getSessionUser, hashPassword, SESSION_COOKIE, toCustomer, verifyPassword } from "@/lib/auth";
import { ensureCart, getCart, getCategories, getProduct, getProducts, money } from "@/lib/storefront";

type Context = { params: Promise<{ path: string[] }> };
type Data = Record<string, unknown>;
const success = <T,>(data: T, status = 200) => NextResponse.json({ success: true, data }, { status, headers: { "Cache-Control": "private, no-store" } });
const failure = (code: string, message: string, status: number) => NextResponse.json({ success: false, error: { code, message } }, { status, headers: { "Cache-Control": "private, no-store" } });
const slugify = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "produk";
const numeric = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : Number.NaN;

async function readBody(request: NextRequest): Promise<Data> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new Error("JSON_REQUIRED");
  const raw = await request.text();
  if (raw.length > 32_768) throw new Error("BODY_TOO_LARGE");
  const value: unknown = JSON.parse(raw || "{}");
  if (!value || Array.isArray(value) || typeof value !== "object") throw new Error("INVALID_JSON");
  return value as Data;
}

async function currentUser(request: NextRequest) {
  return getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
}

async function requireUser(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) throw new Error("AUTH_REQUIRED");
  return user;
}

async function requireAdmin(request: NextRequest) {
  const user = await requireUser(request);
  if (user.role !== "admin") throw new Error("ADMIN_REQUIRED");
  return user;
}

async function cartFor(request: NextRequest, customerId?: number) {
  return ensureCart(request.cookies.get("dsayur_cart")?.value, customerId);
}

function setCartCookie(response: NextResponse, cartId: string) {
  response.cookies.set("dsayur_cart", cartId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return response;
}

function sessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 14 });
  return response;
}

async function adminProducts(search: string) {
  const result = await db.query<{ id: number; name: string; slug: string; description: string; base_price: string; image_url: string; published: boolean; category_ids: number[]; categories: string[]; sku: string | null; stock_quantity: number }>(
    `SELECT p.id,p.name,p.slug,p.description,p.base_price::text,p.image_url,p.published,
       COALESCE(array_agg(DISTINCT c.id) FILTER (WHERE c.id IS NOT NULL),'{}') AS category_ids,
       COALESCE(array_agg(DISTINCT c.name) FILTER (WHERE c.id IS NOT NULL),'{}') AS categories,
       (array_agg(v.sku ORDER BY v.id) FILTER (WHERE v.active))[1] AS sku,
       COALESCE(sum(v.stock_quantity) FILTER (WHERE v.active),0)::int AS stock_quantity
     FROM products p LEFT JOIN product_category_links l ON l.product_id=p.id
     LEFT JOIN categories c ON c.id=l.category_id LEFT JOIN product_variants v ON v.product_id=p.id
     WHERE p.active AND ($1='' OR p.name ILIKE '%' || $1 || '%')
     GROUP BY p.id ORDER BY p.updated_at DESC,p.name LIMIT 200`, [search]);
  return result.rows.map((row) => ({ ...row, price: Number(row.base_price), description: row.description, image: row.image_url || "/placeholder.svg" }));
}

async function adminProduct(id: number) {
  const result = await db.query<{ id: number; name: string; slug: string; description: string; base_price: string; image_url: string; published: boolean; category_ids: number[]; categories: string[]; sku: string | null; stock_quantity: number }>(
    `SELECT p.id,p.name,p.slug,p.description,p.base_price::text,p.image_url,p.published,
       COALESCE(array_agg(DISTINCT c.id) FILTER (WHERE c.id IS NOT NULL),'{}') AS category_ids,
       COALESCE(array_agg(DISTINCT c.name) FILTER (WHERE c.id IS NOT NULL),'{}') AS categories,
       (array_agg(v.sku ORDER BY v.id) FILTER (WHERE v.active))[1] AS sku,
       COALESCE(sum(v.stock_quantity) FILTER (WHERE v.active),0)::int AS stock_quantity
     FROM products p LEFT JOIN product_category_links l ON l.product_id=p.id
     LEFT JOIN categories c ON c.id=l.category_id LEFT JOIN product_variants v ON v.product_id=p.id
     WHERE p.id=$1 GROUP BY p.id`, [id]);
  const row = result.rows[0];
  return row ? { ...row, price: Number(row.base_price), description: row.description, image: row.image_url || "/placeholder.svg" } : null;
}

async function writeProduct(data: Data, id?: number) {
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const description = typeof data.description === "string" ? data.description : "";
  const price = numeric(data.price);
  const stock = data.stock_quantity === undefined ? 0 : numeric(data.stock_quantity);
  const sku = typeof data.sku === "string" && data.sku.trim() ? data.sku.trim().slice(0, 80) : `DS-${Date.now()}`;
  const published = Boolean(data.published);
  const categoryIds = Array.isArray(data.category_ids) ? [...new Set(data.category_ids.map(Number))] : [];
  if (!name || name.length > 200 || !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0 || stock > 1_000_000 || categoryIds.some((value) => !Number.isInteger(value) || value < 1)) throw new Error("INVALID_PRODUCT");
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    let productId: number;
    if (id) {
      const updated = await client.query<{ id: number }>("UPDATE products SET name=$1,slug=$2,description=$3,base_price=$4,published=$5,updated_at=now() WHERE id=$6 RETURNING id", [name, slugify(name), description, price, published, id]);
      if (!updated.rows[0]) throw new Error("PRODUCT_NOT_FOUND");
      productId = updated.rows[0].id;
    } else {
      const created = await client.query<{ id: number }>("INSERT INTO products (name,slug,description,base_price,published) VALUES ($1,$2,$3,$4,$5) RETURNING id", [name, slugify(name), description, price, published]);
      productId = created.rows[0].id;
    }
    await client.query("DELETE FROM product_category_links WHERE product_id=$1", [productId]);
    for (const categoryId of categoryIds) await client.query("INSERT INTO product_category_links (product_id,category_id) VALUES ($1,$2)", [productId, categoryId]);
    const variant = await client.query<{ id: number }>("SELECT id FROM product_variants WHERE product_id=$1 ORDER BY id LIMIT 1", [productId]);
    if (variant.rows[0]) await client.query("UPDATE product_variants SET sku=$1,name='Standar',stock_quantity=$2,active=TRUE WHERE id=$3", [sku, stock, variant.rows[0].id]);
    else await client.query("INSERT INTO product_variants (product_id,sku,name,stock_quantity) VALUES ($1,$2,'Standar',$3)", [productId, sku, stock]);
    await client.query("COMMIT");
    return adminProduct(productId);
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof Error && (error as Error & { code?: string }).code === "23505") throw new Error("SKU_OR_SLUG_EXISTS");
    throw error;
  } finally { client.release(); }
}

async function completeOrder(request: NextRequest, userId: number, data: Data) {
  if (Number(data.provider_id) !== 1 || Number(data.payment_method_id) !== 1) throw new Error("PAYMENT_METHOD_INVALID");
  const cartId = await cartFor(request, userId);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const cartResult = await client.query<{ address_id: number | null; shipping_method_id: number | null; coupon_id: number | null }>("SELECT address_id,shipping_method_id,coupon_id FROM carts WHERE id=$1 AND customer_id=$2 FOR UPDATE", [cartId,userId]);
    const cart = cartResult.rows[0];
    if (!cart?.address_id || !cart.shipping_method_id) throw new Error("CHECKOUT_INCOMPLETE");
    const addressResult = await client.query("SELECT name,phone,street,street2,city,zip,country FROM addresses WHERE id=$1 AND customer_id=$2", [cart.address_id,userId]);
    if (!addressResult.rows[0]) throw new Error("ADDRESS_NOT_FOUND");
    const shippingResult = await client.query<{ price: string }>("SELECT price::text FROM shipping_methods WHERE id=$1 AND active", [cart.shipping_method_id]);
    if (!shippingResult.rows[0]) throw new Error("SHIPPING_METHOD_INVALID");
    const linesResult = await client.query<{ id: number; variant_id: number; quantity: number; product_id: number; product_name: string; slug: string; variant_name: string; sku: string | null; base_price: string; price_override: string | null; tax_rate: string; stock_quantity: number }>(
      `SELECT cl.id,cl.variant_id,cl.quantity,p.id AS product_id,p.name AS product_name,p.slug,v.name AS variant_name,v.sku,p.base_price::text,v.price_override::text,p.tax_rate::text,v.stock_quantity
       FROM cart_lines cl JOIN product_variants v ON v.id=cl.variant_id JOIN products p ON p.id=v.product_id
       WHERE cl.cart_id=$1 AND p.active AND p.published AND v.active FOR UPDATE OF cl,v`, [cartId]);
    if (!linesResult.rows.length) throw new Error("CART_EMPTY");
    if (linesResult.rows.some((line) => line.quantity > line.stock_quantity)) throw new Error("OUT_OF_STOCK");
    const subtotal = linesResult.rows.reduce((sum,line) => sum + Number(line.price_override ?? line.base_price) * line.quantity, 0);
    const tax = linesResult.rows.reduce((sum,line) => sum + Number(line.price_override ?? line.base_price) * line.quantity * Number(line.tax_rate) / 100, 0);
    const shipping = Number(shippingResult.rows[0].price);
    let discount = 0;
    if (cart.coupon_id) {
      const couponResult = await client.query<{ discount_type: string; discount_value: string; minimum_order: string; usage_limit: number | null; usage_count: number; starts_at: Date | null; ends_at: Date | null; active: boolean }>("SELECT * FROM coupons WHERE id=$1 FOR UPDATE", [cart.coupon_id]);
      const coupon = couponResult.rows[0];
      const now = Date.now();
      if (!coupon?.active || (coupon.usage_limit !== null && coupon.usage_count >= coupon.usage_limit) || subtotal < Number(coupon.minimum_order) || (coupon.starts_at && coupon.starts_at.getTime() > now) || (coupon.ends_at && coupon.ends_at.getTime() < now)) throw new Error("COUPON_INVALID");
      discount = coupon.discount_type === "percent" ? subtotal * Number(coupon.discount_value) / 100 : Number(coupon.discount_value);
      discount = Math.min(subtotal + tax, discount);
      await client.query("UPDATE coupons SET usage_count=usage_count+1 WHERE id=$1", [cart.coupon_id]);
    }
    const total = Math.max(0, subtotal + tax + shipping - discount);
    const orderNumber = `DS-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-${randomBytes(4).toString("hex").toUpperCase()}`;
    const createdOrder = await client.query<{ id: number }>(
      `INSERT INTO orders (order_number,customer_id,status,payment_status,payment_method,address_snapshot,subtotal,discount,tax,shipping,total)
       VALUES ($1,$2,'confirmed','unpaid','cod',$3::jsonb,$4,$5,$6,$7,$8) RETURNING id`,
      [orderNumber,userId,JSON.stringify(addressResult.rows[0]),subtotal,discount,tax,shipping,total]);
    const orderId = createdOrder.rows[0].id;
    for (const line of linesResult.rows) {
      const unit = Number(line.price_override ?? line.base_price);
      const lineSubtotal = unit * line.quantity;
      const lineTax = lineSubtotal * Number(line.tax_rate) / 100;
      await client.query("INSERT INTO order_lines (order_id,product_id,variant_id,product_name,variant_name,sku,quantity,unit_price,tax,total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [orderId,line.product_id,line.variant_id,line.product_name,line.variant_name,line.sku,line.quantity,unit,lineTax,lineSubtotal+lineTax]);
      await client.query("UPDATE product_variants SET stock_quantity=stock_quantity-$1 WHERE id=$2", [line.quantity,line.variant_id]);
    }
    await client.query("DELETE FROM cart_lines WHERE cart_id=$1", [cartId]);
    await client.query("UPDATE carts SET address_id=NULL,shipping_method_id=NULL,coupon_id=NULL,updated_at=now() WHERE id=$1", [cartId]);
    await client.query("COMMIT");
    return { completed: true, order_id: orderId, order_number: orderNumber };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

async function changeOrderStatus(orderId:number, nextStatus:string) {
  const transitions:Record<string,string[]>={confirmed:["processing","cancelled"],processing:["shipped","cancelled"],shipped:["delivered"],delivered:[],cancelled:[]};
  const client=await db.connect();
  try {
    await client.query("BEGIN");
    const current=await client.query<{status:string}>("SELECT status FROM orders WHERE id=$1 FOR UPDATE",[orderId]);
    if (!current.rows[0]) throw new Error("ORDER_NOT_FOUND");
    const previous=current.rows[0].status;
    if (previous!==nextStatus && !transitions[previous]?.includes(nextStatus)) throw new Error("ORDER_TRANSITION_INVALID");
    if (previous!==nextStatus && nextStatus==="cancelled") await client.query("UPDATE product_variants v SET stock_quantity=v.stock_quantity+ol.quantity FROM order_lines ol WHERE ol.order_id=$1 AND ol.variant_id=v.id",[orderId]);
    const updated=await client.query("UPDATE orders SET status=$1 WHERE id=$2 RETURNING id,order_number,status,payment_status",[nextStatus,orderId]);
    await client.query("COMMIT");
    return updated.rows[0];
  } catch(error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

async function dispatch(request: NextRequest, context: Context) {
  const { path } = await context.params;
  const method = request.method;
  const pathKey = path.join("/");
  if (!path.length || path.some((part) => part === "." || part === ".." || part.includes("\\"))) return failure("NOT_FOUND","Route not found.",404);
  if (!["GET","POST","PATCH","DELETE"].includes(method)) return failure("METHOD_NOT_ALLOWED","Method not allowed.",405);
  if (method !== "GET") {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return failure("FORBIDDEN","Request origin is not allowed.",403);
  }

  if (method === "GET" && pathKey === "products") {
    const result = await getProducts({ search: request.nextUrl.searchParams.get("search") ?? "", page: Number(request.nextUrl.searchParams.get("page") ?? 1), limit: Number(request.nextUrl.searchParams.get("limit") ?? 24) });
    return success(result);
  }
  if (method === "GET" && path[0] === "products" && path.length === 2) {
    const product = await getProduct(path[1]);
    return product ? success(product) : failure("PRODUCT_NOT_FOUND","Produk tidak ditemukan.",404);
  }
  if (method === "GET" && pathKey === "categories") return success(await getCategories());
  if (method === "GET" && path[0] === "categories" && path.length === 2) {
    const category = await (await import("@/lib/storefront")).getCategory(path[1]);
    return category ? success(category) : failure("CATEGORY_NOT_FOUND","Kategori tidak ditemukan.",404);
  }

  if (method === "POST" && pathKey === "auth/login") {
    const data = await readBody(request);
    const login = typeof data.login === "string" ? data.login.trim() : "";
    const password = typeof data.password === "string" ? data.password : "";
    if (!login || !password || password.length > 256) return failure("INVALID_CREDENTIALS","Username/email dan kata sandi wajib diisi.",400);
    const account = await db.query<{ id: number; username: string; email: string; name: string; role: "customer" | "admin"; phone: string; password_hash: string }>("SELECT * FROM customers WHERE lower(email)=lower($1) OR lower(username)=lower($1) LIMIT 1", [login]);
    const row = account.rows[0];
    if (!row || !(await verifyPassword(password,row.password_hash))) return failure("AUTHENTICATION_FAILED","Username/email atau kata sandi salah.",401);
    const token = await createSession(row.id);
    const user = { id: row.id, username: row.username, email: row.email, name: row.name, role: row.role, phone: row.phone };
    const cartId = await cartFor(request,row.id);
    return setCartCookie(sessionCookie(success(toCustomer(user)),token),cartId);
  }
  if (method === "POST" && pathKey === "auth/register") {
    const data=await readBody(request),name=typeof data.name === "string"?data.name.trim():"",email=typeof data.email === "string"?data.email.trim().toLowerCase():"",password=typeof data.password === "string"?data.password:"",phone=typeof data.phone === "string"?data.phone.trim():"";
    if(name.length<2||name.length>120||!/^\S+@\S+\.\S+$/.test(email)||password.length<8||password.length>256) return failure("REGISTRATION_INVALID","Isi nama, email valid, dan kata sandi minimal 8 karakter.",400);
    try {
      const passwordHash=await hashPassword(password);
      const created=await db.query<{id:number;username:string;email:string;name:string;role:"customer"|"admin";phone:string}>("INSERT INTO customers (username,email,password_hash,name,phone) VALUES ($1,$2,$3,$4,$5) RETURNING id,username,email,name,role,phone",[email,email,passwordHash,name,phone]);
      const user=created.rows[0],token=await createSession(user.id),cartId=await cartFor(request,user.id);
      return setCartCookie(sessionCookie(success(toCustomer(user),201),token),cartId);
    } catch(error) { if ((error as {code?:string}).code === "23505") return failure("EMAIL_EXISTS","Email sudah terdaftar.",409); throw error; }
  }
  if (method === "POST" && pathKey === "auth/logout") {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    await deleteSession(token);
    const response = success({ logged_in:false });
    response.cookies.set(SESSION_COOKIE,"",{httpOnly:true,secure:process.env.NODE_ENV === "production",sameSite:"lax",path:"/",maxAge:0});
    return response;
  }
  if (method === "GET" && pathKey === "auth/me") {
    const user = await currentUser(request);
    return success({ logged_in:Boolean(user), customer:user ? toCustomer(user) : null });
  }

  if (pathKey === "cart" && method === "GET") {
    const user = await currentUser(request);
    const cartId = await cartFor(request,user?.id);
    return setCartCookie(success(await getCart(cartId)),cartId);
  }
  if (pathKey === "cart/lines" && method === "POST") {
    const data = await readBody(request);
    const variantId = Number(data.product_id), quantity = Number(data.quantity ?? 1);
    if (!Number.isInteger(variantId) || variantId < 1 || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) return failure("INVALID_REQUEST","Varian atau jumlah produk tidak valid.",400);
    const user = await currentUser(request), cartId = await cartFor(request,user?.id), client = await db.connect();
    try {
      await client.query("BEGIN");
      const stock = await client.query<{ stock_quantity:number; published:boolean; active:boolean }>("SELECT v.stock_quantity,v.active,p.published AND p.active AS published FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id=$1 FOR UPDATE OF v",[variantId]);
      if (!stock.rows[0]?.active || !stock.rows[0].published) throw new Error("PRODUCT_NOT_AVAILABLE");
      const prior = await client.query<{ quantity:number }>("SELECT quantity FROM cart_lines WHERE cart_id=$1 AND variant_id=$2",[cartId,variantId]);
      const next = (prior.rows[0]?.quantity ?? 0) + quantity;
      if (next > stock.rows[0].stock_quantity) throw new Error("OUT_OF_STOCK");
      await client.query("INSERT INTO cart_lines (cart_id,variant_id,quantity) VALUES ($1,$2,$3) ON CONFLICT (cart_id,variant_id) DO UPDATE SET quantity=EXCLUDED.quantity",[cartId,variantId,next]);
      await client.query("COMMIT");
      return setCartCookie(success(await getCart(cartId)),cartId);
    } catch(error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
  if (path[0] === "cart" && path[1] === "lines" && path.length === 3 && ["PATCH","DELETE"].includes(method)) {
    const cartId = await cartFor(request,(await currentUser(request))?.id), lineId=Number(path[2]);
    if (!Number.isInteger(lineId)) return failure("NOT_FOUND","Baris keranjang tidak ditemukan.",404);
    if (method === "DELETE") await db.query("DELETE FROM cart_lines WHERE id=$1 AND cart_id=$2",[lineId,cartId]);
    else {
      const quantity=Number((await readBody(request)).quantity);
      if (!Number.isInteger(quantity) || quantity < 0 || quantity > 100) return failure("INVALID_REQUEST","Jumlah tidak valid.",400);
      if (!quantity) await db.query("DELETE FROM cart_lines WHERE id=$1 AND cart_id=$2",[lineId,cartId]);
      else {
        const updated=await db.query("UPDATE cart_lines cl SET quantity=$1 FROM product_variants v WHERE cl.id=$2 AND cl.cart_id=$3 AND v.id=cl.variant_id AND $1<=v.stock_quantity",[quantity,lineId,cartId]);
        if (!updated.rowCount) return failure("OUT_OF_STOCK","Stok tidak mencukupi atau item tidak ditemukan.",409);
      }
    }
    return success(await getCart(cartId));
  }

  if (pathKey === "checkout" && method === "GET") {
    const user = await requireUser(request), cartId=await cartFor(request,user.id);
    const [cart,addresses,methods]=await Promise.all([
      getCart(cartId),
      db.query("SELECT id,name,street,street2,city,zip,phone,1 AS country_id,'Indonesia' AS country,false AS state_id FROM addresses WHERE customer_id=$1 ORDER BY id DESC",[user.id]),
      db.query("SELECT id,name,price::float8 AS price FROM shipping_methods WHERE active ORDER BY price,name"),
    ]);
    return setCartCookie(success({cart,addresses:addresses.rows,delivery_methods:methods.rows.map((m) => ({id:m.id,name:m.name,price:money(Number(m.price))})),countries:[{id:1,name:"Indonesia",code:"ID"}]}),cartId);
  }
  if (pathKey === "checkout/address" && method === "POST") {
    const user=await requireUser(request), data=await readBody(request), cartId=await cartFor(request,user.id);
    const name=String(data.name??"").trim(), street=String(data.street??"").trim(), city=String(data.city??"").trim(), zip=String(data.zip??"").trim();
    if (!name || !street || !city || !zip) return failure("ADDRESS_INVALID","Nama, alamat, kota, dan kode pos wajib diisi.",400);
    let addressId:number;
    if (data.address_id) {
      addressId=Number(data.address_id);
      const result=await db.query("UPDATE addresses SET name=$1,phone=$2,street=$3,street2=$4,city=$5,zip=$6 WHERE id=$7 AND customer_id=$8 RETURNING id",[name,String(data.phone??""),street,String(data.street2??""),city,zip,addressId,user.id]);
      if (!result.rows[0]) return failure("ADDRESS_NOT_FOUND","Alamat tidak ditemukan.",404);
    } else {
      const result=await db.query<{id:number}>("INSERT INTO addresses (customer_id,name,phone,street,street2,city,zip) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",[user.id,name,String(data.phone??""),street,String(data.street2??""),city,zip]);
      addressId=result.rows[0].id;
    }
    await db.query("UPDATE carts SET address_id=$1,updated_at=now() WHERE id=$2",[addressId,cartId]);
    return success({address_id:addressId});
  }
  if (pathKey === "checkout/delivery" && method === "POST") {
    const user=await requireUser(request),data=await readBody(request),carrierId=Number(data.carrier_id),cartId=await cartFor(request,user.id);
    const result=await db.query("UPDATE carts SET shipping_method_id=$1,updated_at=now() WHERE id=$2 AND address_id IS NOT NULL AND EXISTS (SELECT 1 FROM shipping_methods WHERE id=$1 AND active) RETURNING id",[carrierId,cartId]);
    if (!result.rows[0]) return failure("SHIPPING_UNAVAILABLE","Alamat atau metode pengiriman belum valid.",400);
    return success(await getCart(cartId));
  }
  if (pathKey === "checkout/payment" && method === "GET") {
    await requireUser(request);
    return success({providers:[{id:1,name:"Bayar di tempat (COD)",code:"cod",flow:"redirect",methods:[{id:1,name:"Tunai saat diterima"}]}]});
  }
  if (pathKey === "checkout/transaction" && method === "POST") {
    const user=await requireUser(request),data=await readBody(request);
    return success(await completeOrder(request,user.id,data));
  }

  if (pathKey === "orders" && method === "GET") {
    const user=await requireUser(request);
    const orders=await db.query<{id:number;order_number:string;created_at:Date;status:string;total:string}>("SELECT id,order_number,created_at,status,total::text FROM orders WHERE customer_id=$1 ORDER BY created_at DESC LIMIT 100",[user.id]);
    return success(orders.rows.map((o)=>({id:o.id,name:o.order_number,date:o.created_at.toISOString(),status:o.status,total:money(Number(o.total))})));
  }
  if (path[0] === "orders" && path.length === 2 && method === "GET") {
    const user=await requireUser(request), orderId=Number(path[1]);
    const order=await (await import("@/lib/account-data")).getOrderForUser(orderId,user.id);
    return order ? success(order) : failure("ORDER_NOT_FOUND","Pesanan tidak ditemukan.",404);
  }

  if (path[0] === "admin") {
    await requireAdmin(request);
    if (pathKey === "admin/categories" && method === "GET") return success(await db.query("SELECT id,name FROM categories WHERE active ORDER BY sequence,name").then((r)=>r.rows));
    if (pathKey === "admin/categories" && method === "POST") {
      const data=await readBody(request),name=typeof data.name === "string" ? data.name.trim() : "";
      if (!name || name.length>100) return failure("CATEGORY_INVALID","Nama kategori wajib diisi (maksimal 100 karakter).",400);
      const slug=slugify(name),result=await db.query<{id:number;name:string;slug:string}>("INSERT INTO categories (name,slug) VALUES ($1,$2) RETURNING id,name,slug",[name,slug]);
      return success(result.rows[0],201);
    }
    if (pathKey === "admin/products" && method === "GET") return success(await adminProducts(request.nextUrl.searchParams.get("search")??""));
    if (pathKey === "admin/products" && method === "POST") return success(await writeProduct(await readBody(request)),201);
    if (path[1] === "products" && path.length === 3 && method === "PATCH") {
      const id=Number(path[2]);
      if (!Number.isInteger(id)) return failure("PRODUCT_NOT_FOUND","Produk tidak ditemukan.",404);
      const product=await writeProduct(await readBody(request),id);
      return product ? success(product) : failure("PRODUCT_NOT_FOUND","Produk tidak ditemukan.",404);
    }
    if (pathKey === "admin/orders" && method === "GET") {
      const result=await db.query("SELECT o.id,o.order_number,o.status,o.payment_status,o.payment_method,o.total::float8 AS total,o.created_at,c.name AS customer_name FROM orders o JOIN customers c ON c.id=o.customer_id ORDER BY o.created_at DESC LIMIT 200");
      return success(result.rows);
    }
    if (path[1] === "orders" && path.length === 3 && method === "PATCH") {
      const id=Number(path[2]),data=await readBody(request),status=String(data.status??"");
      if (!Number.isInteger(id) || !["confirmed","processing","shipped","delivered","cancelled"].includes(status)) return failure("ORDER_STATUS_INVALID","Status pesanan tidak valid.",400);
      return success(await changeOrderStatus(id,status));
    }
  }
  return failure("NOT_FOUND","Route tidak ditemukan.",404);
}

async function handler(request: NextRequest, context: Context) {
  try { return await dispatch(request,context); }
  catch (error) {
    const message=error instanceof Error ? error.message : "";
    if (message === "AUTH_REQUIRED") return failure("AUTHENTICATION_REQUIRED","Silakan masuk ke akun.",401);
    if (message === "ADMIN_REQUIRED") return failure("FORBIDDEN","Fitur ini hanya untuk admin toko.",403);
    if (message === "INVALID_PRODUCT") return failure("PRODUCT_INVALID","Periksa nama, harga, stok, dan kategori produk.",400);
    if (message === "PRODUCT_NOT_FOUND") return failure("PRODUCT_NOT_FOUND","Produk tidak ditemukan.",404);
    if (message === "ORDER_NOT_FOUND") return failure("ORDER_NOT_FOUND","Pesanan tidak ditemukan.",404);
    if (message === "ORDER_TRANSITION_INVALID") return failure("ORDER_TRANSITION_INVALID","Perubahan status pesanan tidak diizinkan.",409);
    if (message === "SKU_OR_SLUG_EXISTS") return failure("DUPLICATE_PRODUCT","SKU atau URL produk sudah digunakan.",409);
    if (message === "OUT_OF_STOCK") return failure("OUT_OF_STOCK","Stok tidak mencukupi. Perbarui keranjang.",409);
    if (message === "PRODUCT_NOT_AVAILABLE") return failure("PRODUCT_NOT_AVAILABLE","Produk tidak tersedia untuk dibeli.",409);
    if (message === "CHECKOUT_INCOMPLETE") return failure("CHECKOUT_INCOMPLETE","Lengkapi alamat dan metode pengiriman dahulu.",400);
    if (message === "ADDRESS_NOT_FOUND") return failure("ADDRESS_NOT_FOUND","Alamat tidak ditemukan.",404);
    if (message === "SHIPPING_METHOD_INVALID") return failure("SHIPPING_UNAVAILABLE","Metode pengiriman tidak tersedia.",400);
    if (message === "CART_EMPTY") return failure("CART_EMPTY","Keranjang kosong.",400);
    if (message === "COUPON_INVALID") return failure("COUPON_INVALID","Kupon tidak berlaku atau telah mencapai batas pemakaian.",400);
    if (message === "PAYMENT_METHOD_INVALID") return failure("PAYMENT_METHOD_INVALID","Metode pembayaran tidak valid.",400);
    if (message === "JSON_REQUIRED") return failure("INVALID_REQUEST","Request harus memakai JSON.",415);
    if (message === "BODY_TOO_LARGE") return failure("REQUEST_TOO_LARGE","Request terlalu besar.",413);
    if (message === "INVALID_JSON") return failure("INVALID_REQUEST","Format request tidak valid.",400);
    console.error("D-Sayur API error:",error);
    return failure("INTERNAL_ERROR","Permintaan belum dapat diproses. Coba lagi.",500);
  }
}

export const GET=handler;
export const POST=handler;
export const PATCH=handler;
export const DELETE=handler;
