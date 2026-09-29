import { Badge, Button, Card, Input } from "@ds/components";

export function DashboardHeader() {
  return (
    <Card>
      <Input label="Search" placeholder="Search projects..." />
      <Badge tone="success">All systems operational</Badge>
      <Button tone="accent">New project</Button>
    </Card>
  );
}
