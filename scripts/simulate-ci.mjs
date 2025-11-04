import path from "node:path";

const projectRoot = path.dirname(import.meta.dirname);

const cleanNodeModules = () => {
  console.log("cleaning node_modules...");
  console.log(`projectRoot: ${projectRoot}`);
};

const main = async () => {
  cleanNodeModules();
};

main()
  .then(() => {
    console.log("Simulated CI build completed successfully.");
  })
  .catch((err) => {
    console.error(err.message);
  });
