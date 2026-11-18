import type { Block, Inline, PageText } from "./i18n/pages/types.ts";

// A long text page (methodology, privacy) from its structured text (i18n/pages).

function Inlines({ parts }: { parts: readonly Inline[] }) {
  return (
    <>
      {parts.map((part, i) =>
        typeof part === "string" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one paragraph never move
          <span key={i}>{part}</span>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: as above
          <a key={i} href={part.href} target="_blank" rel="noreferrer">
            {part.text}
          </a>
        ),
      )}
    </>
  );
}

function BlockView({ block }: { block: Block }) {
  if ("p" in block) {
    return (
      <p className="mt-3 max-w-2xl leading-relaxed">
        <Inlines parts={block.p} />
      </p>
    );
  }
  if ("list" in block) {
    return (
      <ul className="mt-3 max-w-2xl list-disc space-y-2 pl-5 leading-relaxed">
        {block.list.map((item, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: list items are fixed text
          <li key={i}>
            <Inlines parts={item} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <pre className="mt-3 max-w-2xl overflow-x-auto rounded-lg bg-card p-4 font-mono text-sm leading-relaxed">
      {block.formula.join("\n")}
    </pre>
  );
}

export function TextPage({ text }: { text: PageText }) {
  return (
    <article>
      <h1 className="mt-6 max-w-3xl text-4xl leading-tight font-normal tracking-tight sm:mt-12 sm:text-5xl">
        {text.title}
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">{text.intro}</p>
      {text.sections.map((section) => (
        <section key={section.heading} className="mt-10">
          <h2 className="text-xl font-medium tracking-tight">{section.heading}</h2>
          {section.blocks.map((block, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a section's blocks are fixed text
            <BlockView key={i} block={block} />
          ))}
        </section>
      ))}
    </article>
  );
}
