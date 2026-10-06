import { Button as Base } from '@/components/ui/button'
export const Button = ({ quiet }: { quiet?: boolean }) => <Base variant={quiet ? 'ghost' : 'default'} />
