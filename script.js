// navigator.serial
//   .requestPort()
//   .then((port) => {
//     console.log(port);
//   })
//   .catch((e) => {
//     console.log(e);
//   });

const write = () => {
  window.run(
    'Imperialism - the policy and practice of exploiting new nations',
    document.querySelector('#select-style').value,
    document.querySelector('svg'),
  );
};

document.querySelector('button').onclick = write;
