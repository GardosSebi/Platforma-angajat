import { TrainingAssignForm } from "../components/TrainingAssignForm";

export function SsmDashboardPage() {
  return (
    <main>
      <h1>SSM Dashboard</h1>
      <p>Assign mandatory training per employee and tenant.</p>
      <TrainingAssignForm />
    </main>
  );
}
