"""Create separate D-Sayur storefront credentials for demo accounts.

Run only after upgrading dsayur_headless to a version that provides
dsayur.customer.account. This script does not alter Odoo backend passwords.
"""


credentials = {
    "bronze@dsayur.demo": "beliSayur123!",
    "silver@dsayur.demo": "segarSilver123!",
    "gold@dsayur.demo": "segarGold123!",
    "staff@dsayur.demo": "dSayurAdmin2026!",
}

Accounts = env["dsayur.customer.account"].sudo()
Users = env["res.users"].sudo()

for email, password in credentials.items():
    user = Users.search([("login", "=", email)], limit=1)
    if not user:
        raise RuntimeError(f"User Odoo demo tidak ditemukan: {email}")

    account = Accounts.search([("partner_id", "=", user.partner_id.id)], limit=1)
    values = {
        "email": email,
        "password_hash": Accounts._hash_password(password),
        "partner_id": user.partner_id.id,
        "user_id": user.id,
        "active": True,
    }
    if account:
        account.write(values)
    else:
        Accounts.create(values)

env.cr.commit()
print(f"Kredensial storefront D-Sayur diperbarui: {len(credentials)} akun")

