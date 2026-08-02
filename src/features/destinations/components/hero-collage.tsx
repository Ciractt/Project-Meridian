import Image from 'next/image';
import { DESTINATION_IMAGES } from '../image-manifest.generated';

/**
 * Staggered image collage beside the search bar.
 *
 * Populated from the same `public/destinations/` folder as the route cards, so
 * adding artwork improves both at once and there is no second place to maintain.
 *
 * With fewer than three images it renders plain tinted panels instead. That is
 * a deliberate fallback rather than a placeholder: a half-populated photo
 * collage looks broken, whereas the panels look like a decision.
 *
 * Hidden below `lg`. On a phone this space belongs to the search bar, and five
 * decorative images ahead of the fold would be pure cost.
 */
export function HeroCollage() {
  const images = Object.entries(DESTINATION_IMAGES).slice(0, 5);

  if (images.length < 3) {
    return (
      <div aria-hidden="true" className="hidden lg:grid lg:grid-cols-2 lg:gap-3">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className={`overflow-hidden rounded-card border border-hairline bg-panel ${
              index % 3 === 0 ? 'h-40' : 'h-28'
            } ${index === 1 ? 'mt-6' : ''}`}
          />
        ))}
      </div>
    );
  }

  return (
    <div aria-hidden="true" className="hidden lg:grid lg:grid-cols-2 lg:gap-3">
      {images.map(([code, src], index) => (
        <div
          key={code}
          className={`relative overflow-hidden rounded-card ${
            index % 3 === 0 ? 'h-44' : 'h-32'
          } ${index === 1 ? 'mt-8' : ''}`}
        >
          <Image
            src={src}
            alt=""
            fill
            // Decorative and off to one side — never the largest paint, so it
            // must not compete with the search bar for bandwidth.
            sizes="(min-width: 1024px) 20vw, 0px"
            className="object-cover"
          />
        </div>
      ))}
    </div>
  );
}
