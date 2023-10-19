const encoder = new TextEncoder();
const textDecoder = new TextDecoderStream();
const reader = textDecoder.readable.getReader();
let writer;

// Off Paper - 79000
// On Paper  - 80000

const mmToSteps = (mm) => Math.round((mm * 4096) / 9);
const send = async (str) => writer.write(encoder.encode(str + '\n'));
const read = () => reader.read().then(({ value }) => value);
const getLines = () => {
  const initial = document
    .querySelector('textarea')
    .value.replaceAll('\t', '  ')
    .split('\n');
  return initial
    .flatMap((line) => {
      const spacingSize = line.length - line.trimStart().length;
      const spacing = new Array(spacingSize).fill(' ').join('');
      let remaining = line.trimStart();
      const result = [];
      while (remaining.length > 63 - spacingSize) {
        const split = remaining.slice(0, 64 - spacingSize).split(' ');
        const toAdd = split.slice(0, split.length - 1).join(' ');
        result.push(spacing + toAdd);
        remaining = remaining.slice(toAdd.length + 1);
      }
      result.push(spacing + remaining);
      return result;
    })
    .slice(0, 28);
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const svgs = new Array(28)
  .fill(0)
  .map((_, i) => document.querySelector(`#line${i + 1}`));

const pickSerial = async () => {
  try {
    const pico = await navigator.serial.requestPort();
    await pico.open({ baudRate: 115200 });
    pico.readable.pipeTo(textDecoder.writable);
    writer = pico.writable.getWriter();

    document.querySelector('#overlay').style.display = 'none';
  } catch (e) {
    console.error(e);
  }
};

// document.querySelector('#serial').onclick = pickSerial;

const write = async () => {
  const lines = getLines();
  for (const i in lines) {
    const line = lines[i];
    if (line) {
      const coords = window.run(
        line,
        document.querySelector('#select-style').value,
        svgs[i],
      );
      // coords.forEach((letter) =>
      //   console.log(
      //     letter.map((point) => `(${point[0]},${[point[1]]})`).join(','),
      //   ),
      // );
      await wait(1);
    }
  }
};

document.querySelector('#write').onclick = write;

document.querySelectorAll('#paper button').forEach(
  (button) =>
    (button.onclick = (e) => {
      const i = e.target.parentElement.children[0].id.substring(4) - 1;
      if (!getLines()[i]) return;
      window.run(
        getLines()[i],
        document.querySelector('#select-style').value,
        svgs[i],
      );
    }),
);

document.querySelector('#home').onclick = () => send('home');
