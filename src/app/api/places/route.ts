import { NextResponse } from 'next/server';
import { searchPlaces } from '@/services/duffel/flights';
import { mapPlace } from '@/features/flight-search/map';
import { DuffelConfigError } from '@/services/duffel/errors';

/**
 * Airport autocomplete.
 *
 * A Route Handler rather than a Server Action because the combobox fires on
 * every keystroke and needs plain cacheable GETs, not sequential POSTs.
 *
 * The token stays on the server; the browser only ever sees this endpoint.
 */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';

  if (query.length < 2) {
    return NextResponse.json({ places: [] });
  }

  try {
    const places = (await searchPlaces(query))
      .map(mapPlace)
      .filter((place) => place !== null)
      .slice(0, 8);

    return NextResponse.json(
      { places },
      // Airport names don't change. Caching these is the cheapest win
      // available and keeps keystrokes off Duffel entirely.
      { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate' } },
    );
  } catch (error) {
    if (error instanceof DuffelConfigError) {
      return NextResponse.json({ places: [], unconfigured: true }, { status: 200 });
    }
    console.error('Place lookup failed:', error);
    return NextResponse.json({ places: [] }, { status: 200 });
  }
}
