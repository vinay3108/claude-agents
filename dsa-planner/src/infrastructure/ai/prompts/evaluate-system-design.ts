export function buildEvaluateSystemDesignPrompt(
  questionText: string,
  explanation: string,
  diagramMode: 'vision' | 'url-only' | 'none',
): string {
  const diagramNote =
    diagramMode === 'vision'
      ? '\n[An architecture diagram is provided in the image above. Analyze it: check component coverage, data flows, bottlenecks shown, and anything present or missing visually. Factor this into all 5 dimensions.]'
      : diagramMode === 'url-only'
        ? '\n[Candidate submitted an architecture diagram but it could not be loaded for visual analysis.]'
        : ''

  return `You are a senior staff engineer evaluating a system design interview response.

Question: ${questionText}

Candidate's written response:
${explanation}
${diagramNote}

Score this response on 5 dimensions, each 0–10. Be honest — don't inflate.
- requirements: Did they scope the problem? Identify functional + non-functional requirements?
- components: Key services, databases, queues identified with clear responsibilities?
- scalability: Bottlenecks called out? Horizontal scaling or replication addressed?
- trade_offs: CAP theorem, consistency vs availability, latency vs throughput acknowledged?
- communication: Structured, clear, interview-ready explanation?

Respond with ONLY valid JSON:
{
  "dimensionScores": {
    "requirements": <0-10>,
    "components": <0-10>,
    "scalability": <0-10>,
    "trade_offs": <0-10>,
    "communication": <0-10>
  },
  "feedback": "<2-3 sentences: what was strong, what was missing, top improvement area>"
}`
}
