/**
 * ObjectiveCard component
 *
 * A reusable card for the "Our Objectives" section.
 * Props:
 *   - title: string → heading of the card
 *   - description: string → short explanatory text
 *   - iconSrc: string → path to the icon/image
 *   - iconAlt: string → alt text for accessibility
 */
type Props = {
  title: string;
  description: string;
  iconSrc: string;
  iconAlt: string;
};

export default function ObjectiveCard({ title, description, iconSrc, iconAlt }: Props) {
  return (
    <div className="group relative rounded-2xl border border-black/5 bg-white/90 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-within:shadow-md">
      <div className="flex items-start gap-4 p-6 md:p-7">
        {/* Icon frame keeps consistency for different logos */}
        <div className="icon-frame">
          <img src={iconSrc} alt={iconAlt} className="h-10 w-10 object-contain" />
        </div>
        <div>
          <h3 className="text-base md:text-lg font-semibold">{title}</h3>
          <p className="text-muted mt-1">{description}</p>
        </div>
      </div>
      {/* Decorative ring highlight on hover/focus */}
      <span className="pointer-events-none absolute inset-0 rounded-2xl ring-0 ring-brand-600/10 transition group-hover:ring-2 group-focus-within:ring-2"></span>
    </div>
  );
}
