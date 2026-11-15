# Memorials — how the overlay works

The Memorial feature (a "Memorial" section on each deceased person's page,
plus the `memorials.html` gallery) is driven by **`data/memorials.json`** —
a hand-curated overlay that sits beside the generated data.

## Key facts

- **`generate.py` does not touch `memorials.json`.** Regenerating
  `data/people.json` from the GEDCOM never creates, changes, or deletes
  memorial entries. The two files are joined at render time in `site.js`
  on the GEDCOM person id.
- **Headstone photos** live in `assets/headstones/`. Follow the family
  naming convention when adding one:
  `Surname-FirstName-MiddleName_BirthYear-DeathYear_Cemetery-Name_City-State.jpg`
  (shared stones carry both names; leave the cemetery segment out when the
  cemetery is not identified — never invent one).
- **Obituaries** are entered only as **verbatim full texts** taken from a
  held source (funeral home, newspaper, memorial site), with the source
  labelled. Summaries and paraphrases do not belong in the overlay.

## Entry format

`data/memorials.json` is one JSON object keyed by GEDCOM person id:

```json
{
  "I18109010281": {
    "photo": "assets/headstones/Sanders-Joseph-Pearson_1831-1927_Beauvoir-Confederate-Cemetery_Biloxi-MS.jpg",
    "photo_caption": "The headstone of Joseph Pearson Sanders at Beauvoir Confederate Cemetery, Biloxi, Mississippi.",
    "obituary": {
      "source": "Ever Loved",
      "text": "First paragraph of the obituary.\n\nSecond paragraph."
    }
  }
}
```

- `photo` and `obituary` are each optional; an entry may carry either or both.
- `photo_caption` is a plain factual line: whose stone it is, the cemetery
  where known, and any reading of the stone worth noting (e.g. dates carved
  on the stone, a shared stone whose second panel was never carved).
- In `obituary.text`, separate paragraphs with a blank line (`\n\n`); the
  renderer turns each into its own paragraph. Keep the text verbatim,
  including the source's own spellings.

## Privacy rule — deceased only

A memorial may only be attached to a person who is **not flagged living**
in `data/people.json`. `site.js` enforces this in code, twice: the person
page renders no Memorial section for anyone flagged living, and the
gallery filters living people out before sorting. Never add an entry for
a living person; if a person's living flag is ever in doubt, leave the
entry out until it is settled.

## To add a memorial

1. Copy the headstone photo into `assets/headstones/` under the
   convention name above (if there is a photo).
2. Add or extend the person's entry in `data/memorials.json`, keyed by
   their GEDCOM id (the same id used in `person.html?id=…` links).
3. Check the id exists in `data/people.json` and is not flagged living.
4. Reload the person's page and `memorials.html` and confirm the section
   and the gallery card render.
