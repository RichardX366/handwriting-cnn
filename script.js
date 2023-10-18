const encoder = new TextEncoder();
const textDecoder = new TextDecoderStream();
const reader = textDecoder.readable.getReader();

const pickSerial = async () => {
  try {
    const pico = await navigator.serial.requestPort();
    await pico.open({ baudRate: 115200 });
    pico.readable.pipeTo(textDecoder.writable);

    const writer = pico.writable.getWriter();

    const send = (str) => writer.write(encoder.encode(str));

    document.querySelector('#overlay').style.display = 'none';
  } catch (e) {
    console.error(e);
  }
};

document.querySelector('#serial').onclick = pickSerial;

const write = () => {
  window.run(
    'Imperialism - the policy and practice of exploiting new nations',
    document.querySelector('#select-style').value,
    document.querySelector('svg'),
  );
};

document.querySelector('button').onclick = write;
