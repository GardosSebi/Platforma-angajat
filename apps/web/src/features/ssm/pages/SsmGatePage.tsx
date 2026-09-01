import { SsmGateManager } from "../components/SsmGateManager";

export function SsmGatePage() {
  return (
    <>
      <h1 className="page-title">Poartă / admitere</h1>
      <p className="page-lead">
        Flux operațional pentru șefi de tură și poartă: înregistrare vizitatori / detașați / temporari /
        externi, instruire scurtă, fișă colectivă Anexa 12 și lista „nu intra la lucru”.
      </p>
      <SsmGateManager />
    </>
  );
}
