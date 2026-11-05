# RIFT / AUDIO

RIFT is my responsive UI/UX prototype for a fictional headphone brand. I designed the product page for visitors who want to inspect the headphones, compare finishes and save a setup they like.

The core journey is **explore → customise → save**, supported by a movable 3D model and a component explorer.

[View the live demo](https://jupiter847.github.io/rift-audio/)

## The idea

I used off-white, black and signal red to create a strong hierarchy between the product, controls and technical information. Large type and schematic diagrams give the page its technical character.

I kept finish selection and saving in the main flow, with position and zoom under **More controls**. The **Under the Surface** section lets visitors switch between wireframe and solid views of the cushion, frame and controls. Selecting a labelled detail highlights the corresponding part.

## What you can try

- Rotate, move and zoom the headphones.
- Choose Obsidian, Chalk or Signal Red.
- Open the exploded view and explore the parts.
- Switch between Wireframe and Solid views.
- Try the Focus and Aware sound previews.
- Save a setup and download a build card with its product image.

Keyboard controls are included. Saved choices and images stay in your browser.

## Run locally

With Node.js and Python 3 installed:

```sh
npm run dev
```

Open `http://127.0.0.1:4183/`.

Run the framing checks with:

```sh
node --test tests/viewer-framing.test.mjs
```

The site uses HTML, CSS, JavaScript and Three.js. No build step is needed.

## About the concept

N01 is a fictional product. Its specifications are design targets, and the sound preview is an illustrative mix. The website does not take orders or payments.

## Credits

Three.js uses the [MIT licence](dist/vendor/THREE-LICENSE.txt). Barlow Condensed, IBM Plex Mono and Space Grotesk include their font licences in [dist/fonts](dist/fonts).
