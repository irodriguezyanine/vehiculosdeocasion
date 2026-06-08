type StructuredDataProps = {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
};

export function StructuredData({ data }: StructuredDataProps) {
  const blocks = Array.isArray(data) ? data : [data];
  return (
    <>
      {blocks.map((block, index) => (
        <script
          key={`jsonld-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}
    </>
  );
}
