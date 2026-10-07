export function AddressLabelPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="address-label-picker">Nama alamat
    <input maxLength={80} value={value} onChange={(event) => onChange(event.target.value)} placeholder="Contoh: Rumah 1, Rumah 2, atau Kantor" />
  </label>;
}
