import Link from "next/link";

export interface HubCard { href: string; title: string; description: string; accent?: string; }

export default function WorkspaceHub({ title, description, cards }: { title: string; description: string; cards: HubCard[] }) {
  return (
    <section>
      <div className="mb-8 max-w-2xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">SecureNexus workspace</p>
        <h1 className="text-3xl font-bold tracking-tight md:text-5xl">{title}</h1>
        <p className="mt-3 text-slate-400">{description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => <Link key={card.href} href={card.href} className="group rounded-2xl border border-slate-800 bg-slate-900/80 p-6 transition hover:-translate-y-1 hover:border-emerald-400/50 hover:bg-slate-900">
          <div className={`mb-8 h-1 w-12 rounded-full ${card.accent || "bg-emerald-400"}`} />
          <h2 className="text-xl font-semibold group-hover:text-emerald-300">{card.title}</h2>
          <p className="mt-2 min-h-12 text-sm leading-6 text-slate-400">{card.description}</p>
          <span className="mt-6 inline-block text-sm font-semibold text-emerald-300">Open workspace -&gt;</span>
        </Link>)}
      </div>
    </section>
  );
}
