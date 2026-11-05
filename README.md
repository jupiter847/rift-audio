# RIFT / AUDIO

RIFT is my UI/UX concept for a futuristic headphone website. I wanted it to feel bold and technical, while keeping the main task simple: explore the headphones, choose a colour and save a setup.



## The idea

I used off-white, black and signal red, with large type and technical diagrams. The 3D views let people look closer at the product and its parts.

I kept the main controls easy to find and put position and zoom under **More controls**. The **Under the Surface** section shows the cushion, frame and controls as wireframes. Selecting a labelled detail highlights that part.

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
