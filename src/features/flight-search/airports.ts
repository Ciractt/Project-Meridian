import type { Place } from './types';

/**
 * Bundled airport list, used when the live lookup is unavailable.
 *
 * `searchPlaces` now calls Duffel via /api/places and only falls back to this
 * list if the request fails or the token isn't configured. Keeping it means
 * the form is never dead — a lookup outage degrades the airport list rather
 * than breaking the page.
 */
export const AIRPORTS: Place[] = [
  { iataCode: 'LON', name: 'London (all airports)', city: 'London', countryCode: 'GB', isCity: true },
  { iataCode: 'PAR', name: 'Paris (all airports)', city: 'Paris', countryCode: 'FR', isCity: true },
  { iataCode: 'NYC', name: 'New York (all airports)', city: 'New York', countryCode: 'US', isCity: true },
  { iataCode: 'ROM', name: 'Rome (all airports)', city: 'Rome', countryCode: 'IT', isCity: true },
  { iataCode: 'MIL', name: 'Milan (all airports)', city: 'Milan', countryCode: 'IT', isCity: true },
  { iataCode: 'TYO', name: 'Tokyo (all airports)', city: 'Tokyo', countryCode: 'JP', isCity: true },
  { iataCode: 'BER', name: 'Berlin', city: 'Berlin', countryCode: 'DE', isCity: true },
  { iataCode: 'LHR', name: 'Heathrow', city: 'London', countryCode: 'GB' },
  { iataCode: 'LGW', name: 'Gatwick', city: 'London', countryCode: 'GB' },
  { iataCode: 'STN', name: 'Stansted', city: 'London', countryCode: 'GB' },
  { iataCode: 'LTN', name: 'Luton', city: 'London', countryCode: 'GB' },
  { iataCode: 'LCY', name: 'London City', city: 'London', countryCode: 'GB' },
  { iataCode: 'SEN', name: 'Southend', city: 'London', countryCode: 'GB' },
  { iataCode: 'MAN', name: 'Manchester', city: 'Manchester', countryCode: 'GB' },
  { iataCode: 'NCL', name: 'Newcastle', city: 'Newcastle', countryCode: 'GB' },
  { iataCode: 'EDI', name: 'Edinburgh', city: 'Edinburgh', countryCode: 'GB' },
  { iataCode: 'GLA', name: 'Glasgow', city: 'Glasgow', countryCode: 'GB' },
  { iataCode: 'PIK', name: 'Prestwick', city: 'Glasgow', countryCode: 'GB' },
  { iataCode: 'BHX', name: 'Birmingham', city: 'Birmingham', countryCode: 'GB' },
  { iataCode: 'BRS', name: 'Bristol', city: 'Bristol', countryCode: 'GB' },
  { iataCode: 'LPL', name: 'Liverpool John Lennon', city: 'Liverpool', countryCode: 'GB' },
  { iataCode: 'LBA', name: 'Leeds Bradford', city: 'Leeds', countryCode: 'GB' },
  { iataCode: 'EMA', name: 'East Midlands', city: 'Nottingham', countryCode: 'GB' },
  { iataCode: 'BFS', name: 'Belfast International', city: 'Belfast', countryCode: 'GB' },
  { iataCode: 'BHD', name: 'George Best Belfast City', city: 'Belfast', countryCode: 'GB' },
  { iataCode: 'CWL', name: 'Cardiff', city: 'Cardiff', countryCode: 'GB' },
  { iataCode: 'EXT', name: 'Exeter', city: 'Exeter', countryCode: 'GB' },
  { iataCode: 'BOH', name: 'Bournemouth', city: 'Bournemouth', countryCode: 'GB' },
  { iataCode: 'NWI', name: 'Norwich', city: 'Norwich', countryCode: 'GB' },
  { iataCode: 'ABZ', name: 'Aberdeen', city: 'Aberdeen', countryCode: 'GB' },
  { iataCode: 'INV', name: 'Inverness', city: 'Inverness', countryCode: 'GB' },
  { iataCode: 'SOU', name: 'Southampton', city: 'Southampton', countryCode: 'GB' },
  { iataCode: 'MME', name: 'Teesside', city: 'Middlesbrough', countryCode: 'GB' },
  { iataCode: 'HUY', name: 'Humberside', city: 'Hull', countryCode: 'GB' },
  { iataCode: 'JER', name: 'Jersey', city: 'Jersey', countryCode: 'JE' },
  { iataCode: 'GCI', name: 'Guernsey', city: 'Guernsey', countryCode: 'GG' },
  { iataCode: 'IOM', name: 'Isle of Man', city: 'Douglas', countryCode: 'IM' },
  { iataCode: 'DUB', name: 'Dublin', city: 'Dublin', countryCode: 'IE' },
  { iataCode: 'ORK', name: 'Cork', city: 'Cork', countryCode: 'IE' },
  { iataCode: 'SNN', name: 'Shannon', city: 'Shannon', countryCode: 'IE' },
  { iataCode: 'NOC', name: 'Ireland West', city: 'Knock', countryCode: 'IE' },
  { iataCode: 'KIR', name: 'Kerry', city: 'Killarney', countryCode: 'IE' },
  { iataCode: 'LIS', name: 'Humberto Delgado', city: 'Lisbon', countryCode: 'PT' },
  { iataCode: 'OPO', name: 'Francisco Sa Carneiro', city: 'Porto', countryCode: 'PT' },
  { iataCode: 'FAO', name: 'Faro', city: 'Faro', countryCode: 'PT' },
  { iataCode: 'FNC', name: 'Madeira', city: 'Funchal', countryCode: 'PT' },
  { iataCode: 'PDL', name: 'Joao Paulo II', city: 'Ponta Delgada', countryCode: 'PT' },
  { iataCode: 'MAD', name: 'Barajas', city: 'Madrid', countryCode: 'ES' },
  { iataCode: 'BCN', name: 'El Prat', city: 'Barcelona', countryCode: 'ES' },
  { iataCode: 'AGP', name: 'Malaga', city: 'Malaga', countryCode: 'ES' },
  { iataCode: 'ALC', name: 'Alicante', city: 'Alicante', countryCode: 'ES' },
  { iataCode: 'PMI', name: 'Palma de Mallorca', city: 'Palma', countryCode: 'ES' },
  { iataCode: 'IBZ', name: 'Ibiza', city: 'Ibiza', countryCode: 'ES' },
  { iataCode: 'MAH', name: 'Menorca', city: 'Mahon', countryCode: 'ES' },
  { iataCode: 'TFS', name: 'Tenerife South', city: 'Tenerife', countryCode: 'ES' },
  { iataCode: 'TFN', name: 'Tenerife North', city: 'Tenerife', countryCode: 'ES' },
  { iataCode: 'LPA', name: 'Gran Canaria', city: 'Las Palmas', countryCode: 'ES' },
  { iataCode: 'ACE', name: 'Lanzarote', city: 'Arrecife', countryCode: 'ES' },
  { iataCode: 'FUE', name: 'Fuerteventura', city: 'Puerto del Rosario', countryCode: 'ES' },
  { iataCode: 'SVQ', name: 'Seville', city: 'Seville', countryCode: 'ES' },
  { iataCode: 'VLC', name: 'Valencia', city: 'Valencia', countryCode: 'ES' },
  { iataCode: 'BIO', name: 'Bilbao', city: 'Bilbao', countryCode: 'ES' },
  { iataCode: 'GRO', name: 'Girona-Costa Brava', city: 'Girona', countryCode: 'ES' },
  { iataCode: 'RMU', name: 'Region de Murcia', city: 'Murcia', countryCode: 'ES' },
  { iataCode: 'CDG', name: 'Charles de Gaulle', city: 'Paris', countryCode: 'FR' },
  { iataCode: 'ORY', name: 'Orly', city: 'Paris', countryCode: 'FR' },
  { iataCode: 'BVA', name: 'Beauvais-Tille', city: 'Paris', countryCode: 'FR' },
  { iataCode: 'NCE', name: 'Cote d Azur', city: 'Nice', countryCode: 'FR' },
  { iataCode: 'LYS', name: 'Saint-Exupery', city: 'Lyon', countryCode: 'FR' },
  { iataCode: 'MRS', name: 'Marseille Provence', city: 'Marseille', countryCode: 'FR' },
  { iataCode: 'TLS', name: 'Blagnac', city: 'Toulouse', countryCode: 'FR' },
  { iataCode: 'BOD', name: 'Merignac', city: 'Bordeaux', countryCode: 'FR' },
  { iataCode: 'NTE', name: 'Nantes Atlantique', city: 'Nantes', countryCode: 'FR' },
  { iataCode: 'GNB', name: 'Grenoble Alpes-Isere', city: 'Grenoble', countryCode: 'FR' },
  { iataCode: 'FCO', name: 'Fiumicino', city: 'Rome', countryCode: 'IT' },
  { iataCode: 'CIA', name: 'Ciampino', city: 'Rome', countryCode: 'IT' },
  { iataCode: 'MXP', name: 'Malpensa', city: 'Milan', countryCode: 'IT' },
  { iataCode: 'LIN', name: 'Linate', city: 'Milan', countryCode: 'IT' },
  { iataCode: 'BGY', name: 'Orio al Serio', city: 'Bergamo', countryCode: 'IT' },
  { iataCode: 'VCE', name: 'Marco Polo', city: 'Venice', countryCode: 'IT' },
  { iataCode: 'TSF', name: 'Treviso', city: 'Venice', countryCode: 'IT' },
  { iataCode: 'NAP', name: 'Naples', city: 'Naples', countryCode: 'IT' },
  { iataCode: 'PSA', name: 'Galileo Galilei', city: 'Pisa', countryCode: 'IT' },
  { iataCode: 'FLR', name: 'Peretola', city: 'Florence', countryCode: 'IT' },
  { iataCode: 'BLQ', name: 'Guglielmo Marconi', city: 'Bologna', countryCode: 'IT' },
  { iataCode: 'VRN', name: 'Villafranca', city: 'Verona', countryCode: 'IT' },
  { iataCode: 'TRN', name: 'Caselle', city: 'Turin', countryCode: 'IT' },
  { iataCode: 'CTA', name: 'Fontanarossa', city: 'Catania', countryCode: 'IT' },
  { iataCode: 'PMO', name: 'Falcone Borsellino', city: 'Palermo', countryCode: 'IT' },
  { iataCode: 'BRI', name: 'Karol Wojtyla', city: 'Bari', countryCode: 'IT' },
  { iataCode: 'CAG', name: 'Elmas', city: 'Cagliari', countryCode: 'IT' },
  { iataCode: 'OLB', name: 'Costa Smeralda', city: 'Olbia', countryCode: 'IT' },
  { iataCode: 'ATH', name: 'Eleftherios Venizelos', city: 'Athens', countryCode: 'GR' },
  { iataCode: 'SKG', name: 'Makedonia', city: 'Thessaloniki', countryCode: 'GR' },
  { iataCode: 'HER', name: 'Nikos Kazantzakis', city: 'Heraklion', countryCode: 'GR' },
  { iataCode: 'CHQ', name: 'Chania', city: 'Chania', countryCode: 'GR' },
  { iataCode: 'RHO', name: 'Diagoras', city: 'Rhodes', countryCode: 'GR' },
  { iataCode: 'CFU', name: 'Ioannis Kapodistrias', city: 'Corfu', countryCode: 'GR' },
  { iataCode: 'KGS', name: 'Hippocrates', city: 'Kos', countryCode: 'GR' },
  { iataCode: 'ZTH', name: 'Dionysios Solomos', city: 'Zakynthos', countryCode: 'GR' },
  { iataCode: 'JMK', name: 'Mykonos', city: 'Mykonos', countryCode: 'GR' },
  { iataCode: 'JTR', name: 'Santorini', city: 'Santorini', countryCode: 'GR' },
  { iataCode: 'JSI', name: 'Skiathos', city: 'Skiathos', countryCode: 'GR' },
  { iataCode: 'PVK', name: 'Aktion', city: 'Preveza', countryCode: 'GR' },
  { iataCode: 'EFL', name: 'Kefalonia', city: 'Kefalonia', countryCode: 'GR' },
  { iataCode: 'LCA', name: 'Larnaca', city: 'Larnaca', countryCode: 'CY' },
  { iataCode: 'PFO', name: 'Paphos', city: 'Paphos', countryCode: 'CY' },
  { iataCode: 'MLA', name: 'Malta', city: 'Valletta', countryCode: 'MT' },
  { iataCode: 'SPU', name: 'Split', city: 'Split', countryCode: 'HR' },
  { iataCode: 'DBV', name: 'Dubrovnik', city: 'Dubrovnik', countryCode: 'HR' },
  { iataCode: 'ZAG', name: 'Franjo Tudman', city: 'Zagreb', countryCode: 'HR' },
  { iataCode: 'PUY', name: 'Pula', city: 'Pula', countryCode: 'HR' },
  { iataCode: 'ZAD', name: 'Zadar', city: 'Zadar', countryCode: 'HR' },
  { iataCode: 'AMS', name: 'Schiphol', city: 'Amsterdam', countryCode: 'NL' },
  { iataCode: 'EIN', name: 'Eindhoven', city: 'Eindhoven', countryCode: 'NL' },
  { iataCode: 'BRU', name: 'Brussels', city: 'Brussels', countryCode: 'BE' },
  { iataCode: 'CRL', name: 'Brussels South Charleroi', city: 'Charleroi', countryCode: 'BE' },
  { iataCode: 'MUC', name: 'Munich', city: 'Munich', countryCode: 'DE' },
  { iataCode: 'FRA', name: 'Frankfurt', city: 'Frankfurt', countryCode: 'DE' },
  { iataCode: 'DUS', name: 'Dusseldorf', city: 'Dusseldorf', countryCode: 'DE' },
  { iataCode: 'HAM', name: 'Hamburg', city: 'Hamburg', countryCode: 'DE' },
  { iataCode: 'CGN', name: 'Cologne Bonn', city: 'Cologne', countryCode: 'DE' },
  { iataCode: 'STR', name: 'Stuttgart', city: 'Stuttgart', countryCode: 'DE' },
  { iataCode: 'VIE', name: 'Vienna', city: 'Vienna', countryCode: 'AT' },
  { iataCode: 'SZG', name: 'Salzburg', city: 'Salzburg', countryCode: 'AT' },
  { iataCode: 'INN', name: 'Innsbruck', city: 'Innsbruck', countryCode: 'AT' },
  { iataCode: 'ZRH', name: 'Zurich', city: 'Zurich', countryCode: 'CH' },
  { iataCode: 'GVA', name: 'Geneva', city: 'Geneva', countryCode: 'CH' },
  { iataCode: 'BSL', name: 'EuroAirport', city: 'Basel', countryCode: 'CH' },
  { iataCode: 'PRG', name: 'Vaclav Havel', city: 'Prague', countryCode: 'CZ' },
  { iataCode: 'WAW', name: 'Chopin', city: 'Warsaw', countryCode: 'PL' },
  { iataCode: 'KRK', name: 'John Paul II', city: 'Krakow', countryCode: 'PL' },
  { iataCode: 'GDN', name: 'Lech Walesa', city: 'Gdansk', countryCode: 'PL' },
  { iataCode: 'WRO', name: 'Copernicus', city: 'Wroclaw', countryCode: 'PL' },
  { iataCode: 'POZ', name: 'Lawica', city: 'Poznan', countryCode: 'PL' },
  { iataCode: 'KTW', name: 'Katowice', city: 'Katowice', countryCode: 'PL' },
  { iataCode: 'BUD', name: 'Ferenc Liszt', city: 'Budapest', countryCode: 'HU' },
  { iataCode: 'OTP', name: 'Henri Coanda', city: 'Bucharest', countryCode: 'RO' },
  { iataCode: 'CLJ', name: 'Avram Iancu', city: 'Cluj-Napoca', countryCode: 'RO' },
  { iataCode: 'SOF', name: 'Sofia', city: 'Sofia', countryCode: 'BG' },
  { iataCode: 'VAR', name: 'Varna', city: 'Varna', countryCode: 'BG' },
  { iataCode: 'BOJ', name: 'Burgas', city: 'Burgas', countryCode: 'BG' },
  { iataCode: 'IST', name: 'Istanbul', city: 'Istanbul', countryCode: 'TR' },
  { iataCode: 'SAW', name: 'Sabiha Gokcen', city: 'Istanbul', countryCode: 'TR' },
  { iataCode: 'AYT', name: 'Antalya', city: 'Antalya', countryCode: 'TR' },
  { iataCode: 'DLM', name: 'Dalaman', city: 'Dalaman', countryCode: 'TR' },
  { iataCode: 'BJV', name: 'Milas-Bodrum', city: 'Bodrum', countryCode: 'TR' },
  { iataCode: 'ADB', name: 'Adnan Menderes', city: 'Izmir', countryCode: 'TR' },
  { iataCode: 'CPH', name: 'Copenhagen', city: 'Copenhagen', countryCode: 'DK' },
  { iataCode: 'ARN', name: 'Arlanda', city: 'Stockholm', countryCode: 'SE' },
  { iataCode: 'GOT', name: 'Landvetter', city: 'Gothenburg', countryCode: 'SE' },
  { iataCode: 'OSL', name: 'Gardermoen', city: 'Oslo', countryCode: 'NO' },
  { iataCode: 'BGO', name: 'Flesland', city: 'Bergen', countryCode: 'NO' },
  { iataCode: 'HEL', name: 'Helsinki-Vantaa', city: 'Helsinki', countryCode: 'FI' },
  { iataCode: 'KEF', name: 'Keflavik', city: 'Reykjavik', countryCode: 'IS' },
  { iataCode: 'RIX', name: 'Riga', city: 'Riga', countryCode: 'LV' },
  { iataCode: 'TLL', name: 'Lennart Meri', city: 'Tallinn', countryCode: 'EE' },
  { iataCode: 'VNO', name: 'Vilnius', city: 'Vilnius', countryCode: 'LT' },
  { iataCode: 'RAK', name: 'Menara', city: 'Marrakech', countryCode: 'MA' },
  { iataCode: 'AGA', name: 'Al Massira', city: 'Agadir', countryCode: 'MA' },
  { iataCode: 'CMN', name: 'Mohammed V', city: 'Casablanca', countryCode: 'MA' },
  { iataCode: 'TNG', name: 'Ibn Battouta', city: 'Tangier', countryCode: 'MA' },
  { iataCode: 'HRG', name: 'Hurghada', city: 'Hurghada', countryCode: 'EG' },
  { iataCode: 'SSH', name: 'Sharm El Sheikh', city: 'Sharm El Sheikh', countryCode: 'EG' },
  { iataCode: 'CAI', name: 'Cairo', city: 'Cairo', countryCode: 'EG' },
  { iataCode: 'TUN', name: 'Carthage', city: 'Tunis', countryCode: 'TN' },
  { iataCode: 'DJE', name: 'Djerba-Zarzis', city: 'Djerba', countryCode: 'TN' },
  { iataCode: 'DXB', name: 'Dubai International', city: 'Dubai', countryCode: 'AE' },
  { iataCode: 'AUH', name: 'Zayed International', city: 'Abu Dhabi', countryCode: 'AE' },
  { iataCode: 'DOH', name: 'Hamad International', city: 'Doha', countryCode: 'QA' },
  { iataCode: 'JFK', name: 'John F. Kennedy', city: 'New York', countryCode: 'US' },
  { iataCode: 'EWR', name: 'Newark Liberty', city: 'New York', countryCode: 'US' },
  { iataCode: 'LGA', name: 'LaGuardia', city: 'New York', countryCode: 'US' },
  { iataCode: 'BOS', name: 'Logan', city: 'Boston', countryCode: 'US' },
  { iataCode: 'ORD', name: 'O Hare', city: 'Chicago', countryCode: 'US' },
  { iataCode: 'LAX', name: 'Los Angeles', city: 'Los Angeles', countryCode: 'US' },
  { iataCode: 'SFO', name: 'San Francisco', city: 'San Francisco', countryCode: 'US' },
  { iataCode: 'SEA', name: 'Seattle-Tacoma', city: 'Seattle', countryCode: 'US' },
  { iataCode: 'MIA', name: 'Miami', city: 'Miami', countryCode: 'US' },
  { iataCode: 'MCO', name: 'Orlando', city: 'Orlando', countryCode: 'US' },
  { iataCode: 'LAS', name: 'Harry Reid', city: 'Las Vegas', countryCode: 'US' },
  { iataCode: 'DFW', name: 'Dallas Fort Worth', city: 'Dallas', countryCode: 'US' },
  { iataCode: 'IAD', name: 'Dulles', city: 'Washington', countryCode: 'US' },
  { iataCode: 'ATL', name: 'Hartsfield-Jackson', city: 'Atlanta', countryCode: 'US' },
  { iataCode: 'DEN', name: 'Denver', city: 'Denver', countryCode: 'US' },
  { iataCode: 'SAN', name: 'San Diego', city: 'San Diego', countryCode: 'US' },
  { iataCode: 'YYZ', name: 'Pearson', city: 'Toronto', countryCode: 'CA' },
  { iataCode: 'YVR', name: 'Vancouver', city: 'Vancouver', countryCode: 'CA' },
  { iataCode: 'YUL', name: 'Trudeau', city: 'Montreal', countryCode: 'CA' },
  { iataCode: 'YYC', name: 'Calgary', city: 'Calgary', countryCode: 'CA' },
  { iataCode: 'CUN', name: 'Cancun', city: 'Cancun', countryCode: 'MX' },
  { iataCode: 'BGI', name: 'Grantley Adams', city: 'Bridgetown', countryCode: 'BB' },
  { iataCode: 'ANU', name: 'V. C. Bird', city: 'Antigua', countryCode: 'AG' },
  { iataCode: 'MBJ', name: 'Sangster', city: 'Montego Bay', countryCode: 'JM' },
  { iataCode: 'UVF', name: 'Hewanorra', city: 'Saint Lucia', countryCode: 'LC' },
  { iataCode: 'PUJ', name: 'Punta Cana', city: 'Punta Cana', countryCode: 'DO' },
  { iataCode: 'NAS', name: 'Lynden Pindling', city: 'Nassau', countryCode: 'BS' },
  { iataCode: 'SIN', name: 'Changi', city: 'Singapore', countryCode: 'SG' },
  { iataCode: 'BKK', name: 'Suvarnabhumi', city: 'Bangkok', countryCode: 'TH' },
  { iataCode: 'HKT', name: 'Phuket', city: 'Phuket', countryCode: 'TH' },
  { iataCode: 'KUL', name: 'Kuala Lumpur', city: 'Kuala Lumpur', countryCode: 'MY' },
  { iataCode: 'HKG', name: 'Hong Kong', city: 'Hong Kong', countryCode: 'HK' },
  { iataCode: 'NRT', name: 'Narita', city: 'Tokyo', countryCode: 'JP' },
  { iataCode: 'HND', name: 'Haneda', city: 'Tokyo', countryCode: 'JP' },
  { iataCode: 'ICN', name: 'Incheon', city: 'Seoul', countryCode: 'KR' },
  { iataCode: 'DEL', name: 'Indira Gandhi', city: 'Delhi', countryCode: 'IN' },
  { iataCode: 'BOM', name: 'Chhatrapati Shivaji', city: 'Mumbai', countryCode: 'IN' },
  { iataCode: 'BLR', name: 'Kempegowda', city: 'Bangalore', countryCode: 'IN' },
  { iataCode: 'MAA', name: 'Chennai', city: 'Chennai', countryCode: 'IN' },
  { iataCode: 'CMB', name: 'Bandaranaike', city: 'Colombo', countryCode: 'LK' },
  { iataCode: 'MLE', name: 'Velana', city: 'Male', countryCode: 'MV' },
  { iataCode: 'DPS', name: 'Ngurah Rai', city: 'Denpasar', countryCode: 'ID' },
  { iataCode: 'CPT', name: 'Cape Town', city: 'Cape Town', countryCode: 'ZA' },
  { iataCode: 'JNB', name: 'O. R. Tambo', city: 'Johannesburg', countryCode: 'ZA' },
  { iataCode: 'NBO', name: 'Jomo Kenyatta', city: 'Nairobi', countryCode: 'KE' },
  { iataCode: 'MRU', name: 'Sir Seewoosagur Ramgoolam', city: 'Port Louis', countryCode: 'MU' },
  { iataCode: 'SEZ', name: 'Seychelles', city: 'Mahe', countryCode: 'SC' },
  { iataCode: 'SYD', name: 'Kingsford Smith', city: 'Sydney', countryCode: 'AU' },
  { iataCode: 'MEL', name: 'Melbourne', city: 'Melbourne', countryCode: 'AU' },
  { iataCode: 'BNE', name: 'Brisbane', city: 'Brisbane', countryCode: 'AU' },
  { iataCode: 'PER', name: 'Perth', city: 'Perth', countryCode: 'AU' },
  { iataCode: 'AKL', name: 'Auckland', city: 'Auckland', countryCode: 'NZ' },
];

export function findPlace(iataCode: string): Place | undefined {
  return AIRPORTS.find((a) => a.iataCode === iataCode.toUpperCase());
}

/**
 * Airport lookup, live from Duffel with a local fallback.
 *
 * The API route caches aggressively (airport names don't change), so this is
 * cheap despite firing on keystrokes.
 */
export interface PlaceLookup {
  places: Place[];
  /**
   * Where the answer came from.
   *
   * `fallback` means the live lookup was unavailable and these are from the
   * bundled list — which is far shorter than the world. Reporting it lets the UI
   * say so, instead of a broken lookup being indistinguishable from a genuinely
   * unknown airport. That ambiguity is why a missing Porto looked like missing
   * data rather than a failing call.
   */
  source: 'live' | 'fallback';
}

export async function searchPlaces(query: string, limit = 6): Promise<PlaceLookup> {
  const q = query.trim();
  if (q.length < 2) return { places: [], source: 'live' };

  try {
    const response = await fetch(`/api/places?q=${encodeURIComponent(q)}`);
    if (response.ok) {
      const payload = (await response.json()) as {
        places?: Place[];
        source?: string;
      };
      if (payload.source === 'live') {
        return { places: (payload.places ?? []).slice(0, limit), source: 'live' };
      }
      console.warn('Airport lookup unavailable (%s) — using bundled list.', payload.source);
    }
  } catch {
    console.warn('Airport lookup failed — using bundled list.');
  }

  return { places: searchBundledPlaces(q, limit), source: 'fallback' };
}

/** Ranks matches so an exact code wins, then a city, then a name. */
function searchBundledPlaces(query: string, limit: number): Place[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const scored = AIRPORTS.map((place) => {
    const code = place.iataCode.toLowerCase();
    const city = place.city.toLowerCase();
    const name = place.name.toLowerCase();

    let score = -1;
    if (code === q) score = 0;
    else if (city.startsWith(q)) score = 1;
    else if (name.startsWith(q)) score = 2;
    else if (code.startsWith(q)) score = 3;
    else if (city.includes(q) || name.includes(q)) score = 4;

    return { place, score };
  })
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => a.score - b.score || a.place.iataCode.localeCompare(b.place.iataCode));

  return scored.slice(0, limit).map((entry) => entry.place);
}
