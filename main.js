document.getElementById("select-questions").addEventListener("click", () => {
  const input = document.getElementById("questions-input");
  input.click();
});

document.getElementById("questions-input").addEventListener("change", (event) => {
  const files = event.target.files;
  const fileNames = Array.from(files).map((file) => file.name).join(", ");
  document.getElementById("selected-questions").textContent = `Selected: ${fileNames || "None"}`;
});

document.getElementById("select-logs").addEventListener("click", () => {
  const input = document.getElementById("logs-input");
  input.click();
});

document.getElementById("logs-input").addEventListener("change", (event) => {
  const files = event.target.files;
  const fileNames = Array.from(files).map((file) => file.name).join(", ");
  document.getElementById("selected-logs").textContent = `Selected: ${fileNames || "None"}`;
});

document.getElementById("clear").addEventListener("click", () => {
  // Clear file selections
  document.getElementById("questions-input").value = "";
  document.getElementById("logs-input").value = "";
  document.getElementById("selected-questions").textContent = "Selected: None";
  document.getElementById("selected-logs").textContent = "Selected: None";

  // Reset question type checkboxes
  const questionTypeCheckboxes = document.querySelectorAll("#question-types input[type='checkbox']");
  questionTypeCheckboxes.forEach((checkbox) => {
    checkbox.checked = true;
  });

  // Reset delimiter and tournament name
  document.getElementById("delimiter").value = "";
  document.getElementById("tournament").value = "";

  // Reset 'display individual rounds' checkbox
  document.getElementById("display-rounds").checked = false;

  // Optionally update the status message
  document.getElementById("status-message").textContent = "Waiting for input files";
});

document.getElementById("run").addEventListener("click", () => {
  // Get the selected question set files
  const questionFiles = document.getElementById("questions-input").files;
  const questionFileContents = Array.from(questionFiles).map((file) => file);

  // Get the selected quiz log files
  const logFiles = document.getElementById("logs-input").files;
  const logFileContents = Array.from(logFiles).map((file) => file);

  // Get the selected question types
  const questionTypeCheckboxes = document.querySelectorAll("#question-types input[type='checkbox']");
  const selectedQuestionTypes = Array.from(questionTypeCheckboxes)
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.value);

  // Get the delimiter
  const delimiter = document.getElementById("delimiter").value || ",";

  // Get the tournament name
  const tournamentName = document.getElementById("tournament").value || "";

  // Get the display individual rounds option
  const displayRounds = document.getElementById("display-rounds").checked;

  // Call the qperf function
  qperf(questionFileContents, logFileContents, selectedQuestionTypes, delimiter, tournamentName, displayRounds);
});

function qperf(questionFiles, logFiles, questionTypes, delimiter, tournamentName, displayRounds) {
  console.log("Question Files:", questionFiles);
  console.log("Log Files:", logFiles);
  console.log("Question Types:", questionTypes);
  console.log("Delimiter:", delimiter);
  console.log("Tournament Name:", tournamentName);
  console.log("Display Rounds:", displayRounds);

  const questionTypesByRound = getQuestionTypesByRound(questionFiles);
  console.log("Question Types by Round:", questionTypesByRound);
}

function parseRTFFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = event.target.result;
        const roundRegex = /SET #([A-Za-z0-9]+)/g;
        const parts = content.split("\\tab");
        const questionTypesByRound = new Map();

        let currentRound = null;
        let questionTypes = [];

        parts.forEach((part, index) => {
          const match = roundRegex.exec(part);
          if (match) {
            // If a new round is found, save the previous round's data
            if (currentRound && questionTypes.length > 0) {
              questionTypesByRound.set(currentRound, questionTypes);
            }

            // Start a new round
            currentRound = `'${match[1]}'`; // Format round number like Rust
            questionTypes = [];
          }

          // Extract question types (every second part contains question type info)
          if (index % 2 === 0 && part.trim().length > 0) {
            const chars = part.trim().split("");
            if (chars.length > 1) {
              questionTypes.push(chars[chars.length - 2]);
            }
          }
        });

        // Save the last round's data
        if (currentRound && questionTypes.length > 0) {
          questionTypesByRound.set(currentRound, questionTypes);
        }

        // Validate round names
        for (const [round, _types] of questionTypesByRound) {
          if (round === "''") {
            console.warn(
              "Warning: RTF question set file might have been formatted incorrectly. Please use only the original RTF files!"
            );
          }
        }

        resolve(questionTypesByRound);
      } catch (error) {
        reject(`Error parsing RTF file: ${error.message}`);
      }
    };

    reader.onerror = (error) => {
      reject(`Error reading file: ${error.message}`);
    };

    reader.readAsText(file);
  });
}

async function getQuestionTypesByRound(rtfFiles) {
  const questionTypesByRound = new Map();

  for (const file of rtfFiles) {
    try {
      const questionTypes = await parseRTFFile(file);

      // Merge the results into the main map
      for (const [roundNumber, questionTypesArray] of questionTypes.entries()) {
        if (questionTypesByRound.has(roundNumber)) {
          console.warn(
            `Warning: Duplicate question set number: ${roundNumber}. Using only the first occurrence.`
          );
        } else {
          questionTypesByRound.set(roundNumber, questionTypesArray);
        }
      }
    } catch (error) {
      console.error(`Error processing file ${file.name}: ${error}`);
    }
  }

  return questionTypesByRound;
}