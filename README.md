# Allio, an All-In-One Bot 

Allio is a bot that CAN do anything, all it needs for you is to write a module command in the form of a node.js module.

## Run Allio locally

1. [Install Node.js][]
2. Clone the repo and cd into the app directory
3. Run `npm install` to install the app's dependencies
4. Run `npm start` to start the app
5. Access the running app in a browser at http://localhost:6001

## Adding a new command
1. Create a <COMMAND_NAME>.js file in the commands directory.
2. In your new file, export a function called "run" which takes in a string and a callback function.
3. Look at existing commands for guidance.
4. Add your command name and path to `allioConfig.json`.
5. Submit a PR. 
[Install Node.js]: https://nodejs.org/en/download/
