# assets/branches

Photo for each branch card hero.

## Current state

Eight photos, one per branch, named after the branch `id`:

```
senopati.jpg          grandindonesia.jpg   pik.jpg
simatupang.jpg        tangerang.jpg        bekasi.jpg
kemang.jpg            sunter.jpg
```

Each is wired up in `js/data.js` through the branch's `cover` field, for
example:

```js
{
  id: 'senopati',
  name: 'Senopati Sanctuary',
  cover: 'assets/branches/senopati.jpg',
  ...
}
```

They were resized to a maximum width of 1200px at JPEG quality 78, which
keeps all eight under 900 KB total. The hero renders at 474x148 CSS pixels,
so 1200px wide leaves comfortable headroom for 2x screens.

## These are not The Body Project's studios

The branch names and addresses in `BRANCH_DETAILS` are placeholder data, and
so are these photos — they belong to the various studios they were taken in.
Replace them with real photography before this goes anywhere public.

## The abstract fallback

Every card also renders an abstract pattern from `branchArtwork()` in
`app.js` — ripples rising from the bottom edge plus the branch initial as a
watermark. It sits *underneath* the photo as a safety net: if an image fails
to load the `<img>` removes itself and the pattern shows through, so a wrong
path never leaves a broken-image box on the card.

The pattern is also what you see for any branch whose `cover` is `null`.

## Swapping a photo

Put the new file here and change the `cover` path in `js/data.js`. Nothing in
`app.js` needs touching.

## Formats

`serve.js` serves `.png`, `.jpg`, `.svg`, and `.ico`. It does **not** serve
`.webp` or `.avif` — adding those means extending the MIME table in
`serve.js`. `.jpg` is the safe default.
