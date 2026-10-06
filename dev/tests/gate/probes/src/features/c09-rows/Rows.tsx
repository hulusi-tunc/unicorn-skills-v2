import { flat } from '@/api/mock/flat'
export const Rows = () => (
  <ul>
    {flat.people.map((p) => (
      <li key={p}>{p}</li>
    ))}
  </ul>
)
