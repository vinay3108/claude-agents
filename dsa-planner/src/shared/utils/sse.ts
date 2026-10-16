const encoder = new TextEncoder();
export const encodeSseEvent = (data: unknown): Uint8Array =>
  encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
export function sseResponse(events: AsyncIterable<unknown>): Response {
  const iterator = events[Symbol.asyncIterator]();
  return new Response(
    new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { value, done } = await iterator.next();
          if (done) controller.close();
          else controller.enqueue(encodeSseEvent(value));
        } catch (error) {
          console.error("[sse] stream failed", error);
          controller.enqueue(
            encodeSseEvent({
              type: "error",
              message: "The stream failed. Please try again.",
            }),
          );
          controller.close();
        }
      },
      async cancel() {
        await iterator.return?.();
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    },
  );
}
