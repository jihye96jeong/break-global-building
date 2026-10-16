// Dev-only prompt catalogue for scripts/generate-assets.mjs. Never imported by the game (src/).

export const STYLE_ANCHOR =
  'Original 2D side-view arcade game illustration, joyful early-2000s browser-game energy, ' +
  'clean thick dark outlines, expressive shapes, flat cel-shaded colors with subtle highlights, ' +
  'crisp readable silhouette, painterly charm but no photorealism, no 3D render, ' +
  'no realistic disaster, no injuries, no people, no weapons, no logos, no UI, ' +
  'no captions, no words, consistent visual style across a world-tour game.';

const CHROMA =
  'Solid flat vivid magenta (#FF00FF) chroma key studio background, uniform color, ' +
  'no gradient, no clouds, no scenery, no ground, no cast shadow, ' +
  'no adjacent buildings, no text, no watermark, no floating objects.';

// P0 landmarks: id -> what the model needs to know to draw it recognisably.
export const LANDMARKS = {
  gyeongbokgung: {
    name: 'Geunjeongjeon throne hall of Gyeongbokgung Palace', city: 'Seoul, South Korea', aspect: '3:2',
    detail: 'wide two-tiered hip-and-gable roof with dark grey curved giwa roof tiles and upturned eaves, ' +
      'colourful dancheong painted green and red wooden brackets, red wooden pillars, white stone two-level terrace platform with stairs',
    background: 'Seoul: soft spring sky, gentle layered blue-green mountains like Bugaksan in the far distance, a few pine trees low on the horizon',
  },
  lotte_world_tower: {
    name: 'Lotte World Tower skyscraper', city: 'Seoul, South Korea', aspect: '1:2',
    detail: 'very tall slender tapering glass skyscraper with gently curved sides and a pale silver-blue glass facade, ' +
      'subtle vertical seam lines, open lattice crown at the very top, a wide low podium at the base',
    background: 'Seoul modern: clear blue sky, the Han river glinting far away, a soft low skyline of small generic apartment blocks and distant hills',
  },
  tokyo_tower: {
    name: 'Tokyo Tower', city: 'Tokyo, Japan', aspect: '1:2',
    detail: 'red-orange and white striped steel lattice communication tower, four splayed legs, two observation decks, thin antenna spire, ' +
      'clearly visible open lattice with gaps between beams',
    background: 'Tokyo: bright afternoon sky, faint Mount Fuji silhouette far away, low distant generic city rooftops, a few cherry blossom trees',
  },
  eiffel_tower: {
    name: 'Eiffel Tower', city: 'Paris, France', aspect: '1:2',
    detail: 'bronze-brown wrought iron lattice tower with four arched legs, first and second platform, slim top with small cap, ' +
      'clearly visible open lattice with gaps between crossbeams',
    background: 'Paris: pale pastel sky with soft clouds, distant low cream Haussmann rooftops with grey zinc roofs, a faint river and trees',
  },
  big_ben: {
    name: 'Big Ben, the Elizabeth Tower clock tower', city: 'London, United Kingdom', aspect: '1:2',
    detail: 'tall honey-gold Gothic Revival stone clock tower, large round white clock faces with black hands, ' +
      'ornate belfry, dark slate-green pointed spire roof with a small golden finial',
    background: 'London: soft overcast-blue sky with puffy clouds, distant River Thames, low generic brick terraces and green trees',
  },
  colosseum: {
    name: 'Colosseum amphitheatre', city: 'Rome, Italy', aspect: '3:2',
    detail: 'warm travertine-beige elliptical stone amphitheatre with three tiers of round arches and an upper attic wall, ' +
      'partially broken higher outer wall on one side as is famous',
    background: 'Rome: warm golden late-afternoon sky, distant umbrella pine trees, faint terracotta rooftops and gentle hills',
  },
  taj_mahal: {
    name: 'Taj Mahal mausoleum', city: 'Agra, India', aspect: '3:2',
    detail: 'gleaming white marble mausoleum with a large central onion dome topped by a golden finial, four smaller domed chattris, ' +
      'a tall pointed iwan arch in the front, and four slender minarets at the corners of a white plinth',
    background: 'Agra: hazy peach and soft blue morning sky, distant river Yamuna, faint green gardens and low trees on the horizon',
  },
  burj_khalifa: {
    name: 'Burj Khalifa supertall skyscraper', city: 'Dubai, United Arab Emirates', aspect: '1:2',
    detail: 'extremely tall silver-blue glass and steel supertall skyscraper with stepped setbacks spiralling up, ' +
      'Y-shaped plan, needle-like spire at the very top',
    background: 'Dubai: bright warm desert sky fading to pale gold near the horizon, distant small generic modern towers and sand dunes',
  },
};

// Added for the endless mode's 12+ landmark rotation. They share the generic day/sunset/night skies below
// instead of a city plate of their own.
export const EXTRA_LANDMARKS = {
  empire_state: {
    name: 'Empire State Building', city: 'New York, USA', aspect: '1:2',
    detail: 'tall limestone-grey Art Deco skyscraper with stepped setbacks near the top, vertical window stripes, ' +
      'a slim mast and antenna spire on top',
  },
  taipei_101: {
    name: 'Taipei 101 skyscraper', city: 'Taipei, Taiwan', aspect: '1:2',
    detail: 'tall green-blue glass skyscraper built from eight repeated flared pagoda-like segments stacked on a tapered base, ' +
      'clearly separated repeating segments, slim spire on top',
  },
  petronas_towers: {
    name: 'Petronas Twin Towers', city: 'Kuala Lumpur, Malaysia', aspect: '2:3',
    detail: 'two identical tall silver stainless-steel towers side by side with stepped tiers and pointed spires, ' +
      'joined by a two-storey sky bridge in the middle',
  },
  sydney_opera_house: {
    name: 'Sydney Opera House', city: 'Sydney, Australia', aspect: '3:2',
    detail: 'white overlapping sail-shaped shell roofs with subtle tile texture, sitting on a wide warm granite podium with steps',
  },
  leaning_tower_pisa: {
    name: 'Leaning Tower of Pisa', city: 'Pisa, Italy', aspect: '1:2',
    detail: 'white marble cylindrical bell tower with stacked rings of arched colonnades, visibly leaning to one side, small belfry on top',
  },
};

// More real landmarks (story levels use only real landmarks; small ones for the first levels).
export const MORE_LANDMARKS = {
  cheomseongdae: { name: 'Cheomseongdae observatory', city: 'Gyeongju, South Korea', aspect: '2:3',
    detail: 'small ancient granite bottle-shaped stone observatory tower built from stacked rounded stone courses on a square base, a small square window halfway up and a square two-tier stone frame on top' },
  sungnyemun: { name: 'Sungnyemun gate (Namdaemun)', city: 'Seoul, South Korea', aspect: '4:3',
    detail: 'traditional Korean fortress gate: a massive granite stone base with one arched tunnel, topped by a two-storey wooden pavilion with sweeping curved grey tiled roofs and colourful dancheong eaves' },
  brandenburg_gate: { name: 'Brandenburg Gate', city: 'Berlin, Germany', aspect: '4:3',
    detail: 'neoclassical sandstone gate with twelve Doric columns forming five passages, a wide entablature and the green copper Quadriga chariot statue on top' },
  arc_de_triomphe: { name: 'Arc de Triomphe', city: 'Paris, France', aspect: '1:1',
    detail: 'massive pale stone triumphal arch with one huge central archway, relief sculptures on the pillars and a flat attic top' },
  kinkakuji: { name: 'Kinkaku-ji Golden Pavilion', city: 'Kyoto, Japan', aspect: '1:1',
    detail: 'three-storey Japanese temple pavilion covered in gold leaf, dark wooden first floor, layered thin shingled roofs and a golden phoenix on the very top' },
  himeji_castle: { name: 'Himeji Castle', city: 'Himeji, Japan', aspect: '1:1',
    detail: 'white Japanese castle keep with several stacked white plaster storeys, grey curved gabled roofs and a tall sloping stone base' },
  st_basils: { name: "Saint Basil's Cathedral", city: 'Moscow, Russia', aspect: '2:3',
    detail: 'red brick cathedral with a cluster of colourful striped and spiralled onion domes of different heights, a central tall tent-roof spire' },
  statue_of_liberty: { name: 'Statue of Liberty', city: 'New York, USA', aspect: '1:2',
    detail: 'green copper statue of a robed figure holding a torch high and a tablet, spiked crown, standing on a tall granite star-fort pedestal' },
  sagrada_familia: { name: 'Sagrada Familia basilica', city: 'Barcelona, Spain', aspect: '2:3',
    detail: 'ornate sandstone basilica with several tall perforated spindle-shaped spires topped with colourful mosaic pinnacles, richly carved facade' },
  space_needle: { name: 'Space Needle', city: 'Seattle, USA', aspect: '1:2',
    detail: 'slender white futuristic observation tower with three curved legs pinched at the waist and a wide flying-saucer-shaped top deck with a thin spire' },
  n_seoul_tower: { name: 'N Seoul Tower', city: 'Seoul, South Korea', aspect: '1:2',
    detail: 'tall slim white communication tower with a round observation deck pod near the top and a long antenna, standing on a small base building' },
  cn_tower: { name: 'CN Tower', city: 'Toronto, Canada', aspect: '1:2',
    detail: 'extremely tall slender concrete communication tower with a Y-shaped base, a large doughnut-shaped observation pod high up, a smaller sky pod above and a long thin antenna' },
};

// Generic skies for the endless mode, chosen per landmark (day / sunset / night).
export const SKIES = {
  sky_day: 'a bright daytime sky with soft white clouds over a distant generic low city skyline',
  sky_sunset: 'a warm orange and pink sunset sky with long soft clouds over a distant generic low city skyline silhouette',
  sky_night: 'a deep blue night sky with stars and a big moon over a distant generic low city skyline with tiny lit windows',
  // v5 story mode time-of-day plates
  sky_golden: 'a warm golden late-afternoon sky, low sun behind thin clouds, long soft light over a distant generic low city skyline',
  sky_twilight: 'a purple and pink twilight sky just after sunset, the first stars, distant generic low city skyline with a few lit windows',
  sky_deepnight: 'a very dark navy deep-night sky full of stars and a pale moon, faint distant lightning glow on the horizon, distant generic city skyline with many tiny lit windows',
};

export function buildingPrompt(id) {
  const l = LANDMARKS[id] ?? EXTRA_LANDMARKS[id] ?? MORE_LANDMARKS[id];
  return `${STYLE_ANCHOR}\nA SINGLE iconic, instantly recognizable ${l.name} in ${l.city}: ${l.detail}. ` +
    'Show the complete landmark from its base to its highest point, full front-facing or slightly elevated orthographic game view, ' +
    'all architectural parts visible, centered with generous clean margins and a clearly readable silhouette. ' +
    `This is a clean isolated building SPRITE intended for procedural destruction. ${CHROMA} ` +
    'Keep the building recognizable and coherent, simplified into colorful arcade shapes. The building must not contain any magenta or pink colour.';
}

export function backgroundPrompt(id) {
  const l = LANDMARKS[id];
  return `${STYLE_ANCHOR}\nA colorful illustrated atmospheric background for an arcade game stage set in ${l.city}. ${l.background}. ` +
    'Soft layered sky, distant scenery and subtle local atmosphere characteristic of the city. ' +
    'Everything in the scenery stays low and small in the bottom quarter of the frame; the upper and middle area is open sky. ' +
    'The CENTER must stay visually quiet and mostly empty for a foreground landmark sprite. ' +
    `Absolutely DO NOT include the ${l.name} or any dominant landmark or tall tower in the scene. ` +
    'Background plate only, no foreground character, no interface, no text, no watermark. ' +
    'Wide horizontal desktop game composition, 16:9, with readable foreground separation.';
}

const HERO_BASE =
  'An original small blue arcade demolition hero, simplified expressive humanoid character, ' +
  'large clear head, compact torso, distinct arms and legs, bright cobalt-blue costume with white gloves and red scarf, ' +
  'recognizable even at 48 pixels tall, friendly adventurous expression, full body visible, side view facing right';

export const HERO_POSES = {
  hero_idle: `${STYLE_ANCHOR}\n${HERO_BASE}, neutral standing idle pose, plain solid flat magenta (#FF00FF) background, ` +
    'character only, no props, no text, no extra limbs, no shadow. The character must not contain any magenta or pink colour.',
  hero_attack: 'Same exact character, same colours, same outfit and proportions, same art style, now in a dynamic upward uppercut punch pose: ' +
    'jumping slightly, one fist thrust straight up overhead, legs tucked. Plain solid flat magenta (#FF00FF) background, character only, no effects, no text, no shadow.',
  hero_hit: 'Same exact character, same colours, same outfit and proportions, same art style, now in a comical dizzy knocked-back pose: ' +
    'leaning back, arms flailing, swirly eyes, cartoon bump, no injury. Plain solid flat magenta (#FF00FF) background, character only, no text, no shadow.',
};

// The playable hero: a ninja with an oversized sword. The weapon is the point here, so this anchor drops
// the shared style anchor's "no weapons"; poses after idle are edits of the idle image to keep one character.
const NINJA_ANCHOR = STYLE_ANCHOR.replace(' no weapons,', '');
const NINJA = 'An original cool arcade ninja hero, sleek midnight-indigo ninja outfit with a long flowing crimson scarf, ' +
  'black mask with determined glowing eyes, lean athletic proportions, wielding one HUGE oversized two-handed great sword ' +
  'with a broad steel blade almost as long as the ninja is tall and a gold-wrapped hilt, full body visible, side view facing right, ' +
  'readable at 80 pixels tall, plain solid flat magenta (#FF00FF) background, character only, no text, no shadow, no extra limbs. ' +
  'The character and sword must not contain any magenta or pink colour.';
export const NINJA_POSES = {
  ninja_idle: `${NINJA_ANCHOR}\n${NINJA} Ready stance, knees bent, the giant sword resting on one shoulder.`,
  // v3: the blade must meet the building just above the head (short, honest reach), like the guard pose but slashing
  ninja_attack: 'Same exact ninja, same outfit, colours, proportions and the same huge sword, same art style. Now a fierce upward slash ' +
    'that connects just above the head: legs braced, both arms raised, the giant sword swept flat and nearly horizontal ' +
    'slightly above the top of the head, blade edge facing up, slight motion tilt, scarf whipping. The blade is the highest point ' +
    'and sits only a little above the head. Plain solid flat magenta (#FF00FF) background, character only, no effects, no text, no shadow.',
  ninja_jump: 'Same exact ninja, same outfit, colours, proportions and the same huge sword, same art style. Now mid-air in a high jump: ' +
    'knees tucked, giant sword held back ready to strike, scarf trailing. Plain solid flat magenta (#FF00FF) background, character only, no text, no shadow.',
  ninja_guard: 'Same exact ninja, same outfit, colours, proportions and the same huge sword, same art style. Now guarding: crouched low, ' +
    'holding the giant sword flat and horizontal above the head with both hands like a shield against something falling from above. ' +
    'Plain solid flat magenta (#FF00FF) background, character only, no text, no shadow.',
  ninja_hurt: 'Same exact ninja, same outfit, colours, proportions and the same huge sword, same art style. Now comically knocked back: ' +
    'stumbling backwards, dizzy swirl eyes, cartoon stars, sword wobbling, no injury. Plain solid flat magenta (#FF00FF) background, character only, no text, no shadow.',
};

// The full job list. type: building | background | character
export function allJobs() {
  const jobs = [];
  for (const id of Object.keys(LANDMARKS)) {
    jobs.push({ id, type: 'building', prompt: buildingPrompt(id), aspect: LANDMARKS[id].aspect, resolution: '2k', quality: 'medium' });
    jobs.push({ id, type: 'background', prompt: backgroundPrompt(id), aspect: '16:9', resolution: '2k', quality: 'medium' });
  }
  for (const id of Object.keys(EXTRA_LANDMARKS)) {
    jobs.push({ id, type: 'building', prompt: buildingPrompt(id), aspect: EXTRA_LANDMARKS[id].aspect, resolution: '2k', quality: 'medium' });
  }
  for (const id of Object.keys(MORE_LANDMARKS)) {
    jobs.push({ id, type: 'building', prompt: buildingPrompt(id), aspect: MORE_LANDMARKS[id].aspect, resolution: '1k', quality: 'medium' });
  }
  for (const [id, scene] of Object.entries(SKIES)) {
    jobs.push({ id, type: 'background', aspect: '16:9', resolution: '2k', quality: 'medium',
      prompt: `${STYLE_ANCHOR}\nA colorful illustrated atmospheric background plate for an arcade game: ${scene}. ` +
        'Everything in the scenery stays low and small in the bottom quarter; the rest is open sky. ' +
        'No dominant landmark, no tall tower, no characters, no interface, no text, no watermark. Wide horizontal 16:9 composition.' });
  }
  jobs.push({ id: 'ninja_idle', type: 'character', prompt: NINJA_POSES.ninja_idle, aspect: '1:1', resolution: '1k', quality: 'medium' });
  for (const id of ['ninja_attack', 'ninja_jump', 'ninja_guard', 'ninja_hurt']) {
    jobs.push({ id, type: 'character', prompt: NINJA_POSES[id], aspect: '1:1', resolution: '1k', quality: 'medium', editFrom: 'ninja_idle' });
  }
  jobs.push({ id: 'special_cutin', type: 'fx', aspect: '16:9', resolution: '1k', quality: 'medium',
    prompt: `${STYLE_ANCHOR}\nAn abstract dramatic arcade special-move cut-in background: a single huge diagonal white-blue sword-light slash ` +
      'across the frame with speed lines and sparks on a deep indigo backdrop. No characters, no weapons drawn as objects, no text, no letters.' });
  // The hero is a simple stick figure drawn in code (src/game/Player.ts). The illustrated hero below is kept as an
  // optional job: npm run assets:generate -- --id=hero_idle --with-hero
  if (process.argv.includes('--with-hero')) {
    jobs.push({ id: 'hero_idle', type: 'character', prompt: HERO_POSES.hero_idle, aspect: '1:1', resolution: '1k', quality: 'medium' });
    jobs.push({ id: 'hero_attack', type: 'character', prompt: HERO_POSES.hero_attack, aspect: '1:1', resolution: '1k', quality: 'medium', editFrom: 'hero_idle' });
    jobs.push({ id: 'hero_hit', type: 'character', prompt: HERO_POSES.hero_hit, aspect: '1:1', resolution: '1k', quality: 'medium', editFrom: 'hero_idle' });
  }
  return jobs;
}

export const SAMPLE_KEYS = ['building:gyeongbokgung', 'background:gyeongbokgung'];
