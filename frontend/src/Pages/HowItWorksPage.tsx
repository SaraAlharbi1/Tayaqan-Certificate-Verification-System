// src/pages/HowItWorksPage.tsx
import DownloadIcon from "@/assets/Download-icon.png";
import SendIcon from "@/assets/Send-icon.png";
import CheckIcon from "@/assets/Check-icon.png";
import UserIcon from "@/assets/User-icon.png";

export default function HowItWorksPage() {
  const steps = [
    {
      icon: DownloadIcon,
      alt: "Institutions issue certificates",
      titleTop: "Institutions",
      titleBottom: "Issue Certificates",
    },
    {
      icon: SendIcon,
      alt: "Employers request access",
      titleTop: "Employers",
      titleBottom: "Request Access",
    },
    {
      icon: CheckIcon,
      alt: "Applicants approve request",
      titleTop: "Applicants",
      titleBottom: "Approve Request",
    },
    {
      icon: UserIcon,
      alt: "Employers verify instantly",
      titleTop: "Employers",
      titleBottom: "Verify Instantly",
    },
  ];

  return (
    <section className="bg-white -mt-6 md:-mt-10">
      <div className="mx-auto max-w-6xl px-6 pt-8 md:pt-10 pb-14 md:pb-16">
        {/* Heading + subtitle (brand gradient style) */}
        <h2 className="text-center text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
          How it{" "}
          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            works
          </span>
        </h2>
        <p className="mt-2 text-center text-muted">
          Four simple steps to secure, permissioned certificate verification.
        </p>
        <div className="flex justify-center mt-4 mb-10">
          <span className="block h-1 w-16 bg-brand-600 rounded-full" />
        </div>

        {/* Steps */}
        <div className="grid gap-6 md:grid-cols-4">
          {steps.map((s, i) => (
            <div
              key={i}
              className="group relative rounded-2xl border border-black/5 bg-white/90 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md p-7 text-center"
            >
              {/* Step number badge */}
              <span className="absolute -top-3 -left-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white text-sm font-semibold shadow-sm">
                {i + 1}
              </span>

              <img
                src={s.icon}
                alt={s.alt}
                className="h-10 w-10 mx-auto mb-4 transition-transform group-hover:scale-110 select-none"
                draggable={false}
              />
              <h3 className="font-semibold text-lg leading-snug">
                {s.titleTop}
                <br />
                {s.titleBottom}
              </h3>

              {/* Hover ring */}
              <span className="pointer-events-none absolute inset-0 rounded-2xl ring-0 ring-brand-600/10 transition group-hover:ring-2" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
