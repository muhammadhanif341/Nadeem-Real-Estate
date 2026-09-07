export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // JSON-LD requires a raw <script> tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
