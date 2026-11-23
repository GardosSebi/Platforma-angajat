import { SsmGateManager } from "../components/SsmGateManager";

export function SsmGatePage() {
  return (
    <section className="ssm-active-section">
      <header className="ssm-active-section-header">
        <h1 className="page-title">Poartă / admitere</h1>
      </header>
      <SsmGateManager />
    </section>
  );
}
