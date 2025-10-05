import { cn } from "../../lib/cn";
export default function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass p-6 border-gradient", className)} {...props} />;
}