import { createFileRoute } from "@tanstack/react-router";
import { DocPage } from "#/components/doc/DocPage";
import { canonicalLink } from "#/lib/seo-head";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact | kerf" },
      {
        name: "description",
        content: "Get in touch with kerf — feedback, bug reports, beta requests.",
      },
      { property: "og:url", content: "https://typekerf.com/contact" },
    ],
    links: [canonicalLink("/contact")],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <DocPage
      title="Contact"
      lede="There are a couple of ways to get in touch — depends on what's on your mind."
    >
      <h2>Found a bug? Have a feature idea?</h2>
      <p>
        If you've found a bug or thought of something kerf should do, GitHub Issues is a good home
        for it. Things filed there are easier to track, easier for others to follow, and easier to
        circle back to once they're fixed or shipped.
      </p>
      <p>
        →{" "}
        <a
          href="https://github.com/shariski/kerf/issues/new"
          target="_blank"
          rel="noopener noreferrer"
        >
          Report a bug or suggest a feature
        </a>{" "}
        (opens GitHub)
      </p>

      <h2>General questions or feedback</h2>
      <p>
        Anything else? Send a note to <a href="mailto:hello@typekerf.com">hello@typekerf.com</a> —
        questions, thoughts, things that don't quite fit the GitHub format.
      </p>

      <h2>The code</h2>
      <p>
        kerf's source is open under the MIT License — feel free to poke around, read the docs, or
        see what's coming next.
      </p>
      <p>
        →{" "}
        <a href="https://github.com/shariski/kerf" target="_blank" rel="noopener noreferrer">
          github.com/shariski/kerf
        </a>{" "}
        (opens GitHub)
      </p>
    </DocPage>
  );
}
