import { DSButton } from '@/components/DSButton'
export const Screen = ({ order }: { order: number }) => (
  <main className="bg-[#1a2b3c] p-4">
    <p style={{ color: 'rgb(10 20 30)' }}>Order #123 is ready</p>
    <div className="p-[13px] min-[900px]:flex">{order}</div>
    <a href="#add">Add</a>
    <div className="bg-[hsl(var(--primary))] text-accent-600" />
    <button type="button">Raw</button>
    <input type="hidden" name="id" value="1" />
    <DSButton>Save</DSButton>
  </main>
)
