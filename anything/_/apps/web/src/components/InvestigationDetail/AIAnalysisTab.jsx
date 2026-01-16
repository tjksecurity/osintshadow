import { JSONViewer } from "./JSONViewer";

export function AIAnalysisTab({ ai }) {
  return (
    <section className="bg-[#2D384E] rounded-lg p-4 overflow-auto">
      <h3 className="font-semibold mb-3">AI Full Output</h3>
      <JSONViewer data={ai.full || {}} />
    </section>
  );
}
