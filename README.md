# Jayadeep Sanka — portfolio

A responsive, static portfolio built with HTML, CSS and JavaScript. It uses local fonts and assets, with no package dependencies or build step.

## Run locally

Install Node.js 18 or newer, then run from this directory:

```sh
npm start
```

Open the local URL printed in the terminal. Run `npm run check` to check JavaScript syntax, local assets, navigation anchors, external-link safety and the project pipeline tabs.

## Edit

- `dist/index.html`: copy, projects, credentials and contact links.
- `dist/styles.css`: typography, layout, responsive rules and reduced-motion behavior.
- `dist/app.js`: keyboard-accessible pipeline tabs, email copying and active navigation.
- `dist/assets/`: images, local fonts and certificate PDFs.

The Resume buttons open this supplied Google Drive URL in a new tab:

https://drive.google.com/file/d/1mGaC7lLC8mVqC6ddERlYNnNauUKjBsdC/view?usp=drive_link

## Deploy

Serve the **contents of `dist/`** on any static host. The included Node server is for convenient local preview; a hosted backend is not required.

- **Netlify:** drag the `dist` folder into Netlify's manual deployment drop zone. No build command is needed.
- **GitHub Pages:** publish the contents of `dist` at the root of a Pages repository or use an Actions workflow that uploads `dist` as the Pages artifact. Asset paths are relative, so repository subpaths work.

When deploying to a different domain, update `og:url` in `dist/index.html`. Keep the `assets` directory alongside `index.html`, `styles.css` and `app.js`.

## Content and source notes

The supplied resume, certificates, academic cover and GitHub repository informed the content. The satellite study is an academic team project. Its displayed accuracy figures are the results reported in the resume for that project's test set; they are not independent validation or general performance guarantees.

Resume Ranking links to the supplied public repository. No repository or live demo was supplied for the satellite or finance projects, so those links are omitted. There are no placeholder demo buttons. The land-cover map is a conceptual schematic, not actual satellite imagery or a model output.

The LinkedIn and Google Drive URLs follow the user's supplied links. Check that the Drive resume remains viewable by the intended audience when sharing the portfolio.
