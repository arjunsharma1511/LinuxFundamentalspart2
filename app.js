"use strict";

const $ = id => document.getElementById(id);
const lesson = $("lesson");
const input = $("command");
const output = $("output");
const storageKey = "cedar-linux-fundamentals-2";
const total = missions.length + 2;
const chapterStarts = missions.reduce((starts, mission, index) => {
  if (index === 0 || missions[index - 1].chapter !== mission.chapter) starts.push(index);
  return starts;
}, []);
const freshProgress = { done: 0, unlocked: false, review: false, flag: false };
let saved = { ...freshProgress };
try {
  const previous = JSON.parse(localStorage.getItem(storageKey));
  if (Number.isInteger(previous?.done) && previous.done >= 0 && previous.done <= missions.length) {
    saved = { ...freshProgress, ...previous };
  }
} catch {
  // Keep the exercise available if local storage cannot be read.
}
let session = createSession();
let step = resumeStep();
const transcript = [];
for (let index = 0; index < saved.done; index++) {
  const prompt = session.prompt;
  const result = session.execute(missions[index].command);
  transcript.push({ prompt, result });
}

function resumeStep() {
  if (saved.done < missions.length) return saved.done;
  return saved.review ? missions.length + 1 : missions.length;
}

function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(saved));
  } catch {
    $("terminal-status").textContent = "Browser storage is unavailable. Keep this tab open to retain progress.";
  }
}

function choices(question, answers, correctIndex, name, showCorrect = false) {
  const options = [...answers];
  const [correct] = options.splice(0, 1);
  options.splice(correctIndex, 0, correct);
  return '<fieldset><legend>' + question + '</legend>' + options.map((value, index) =>
    '<label class="option"><input type="radio" name="' + name + '" value="' + index + '"' +
    (showCorrect && index === correctIndex ? " checked disabled" : showCorrect ? " disabled" : "") +
    '><code>' + escapeHtml(value) + '</code></label>'
  ).join("") + "</fieldset>";
}

function escapeHtml(value) {
  return value.replace(/[&<>"]/g, character =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}

function setFeedback(message, good) {
  const feedback = $("feedback");
  feedback.textContent = message;
  feedback.className = "feedback " + (good ? "success" : "error");
}

function renderNavigation() {
  const items = chapterStarts.map((start, index) => {
    const end = chapterStarts[index + 1] ?? missions.length;
    const count = Math.max(0, Math.min(saved.done, end) - start);
    return { start, end, title: missions[start].chapter, state: count + "/" + (end - start) + " commands" };
  });
  items.push({ start: missions.length, end: missions.length + 1, title: "Final questions", state: saved.review ? "Complete" : "6 questions" });
  items.push({ start: missions.length + 1, end: missions.length + 2, title: "Submit the flag", state: saved.flag ? "Complete" : "1 flag" });
  const maximum = resumeStep();
  $("chapters").innerHTML = items.map(({ start, end, title, state }) =>
    '<button type="button" data-step="' + start + '"' + (start > maximum ? " disabled" : "") +
    (step >= start && step < end ? ' aria-current="step"' : "") +
    '>' + title + '<small>' + (start > maximum ? "Locked · " : "") + state + "</small></button>"
  ).join("");
}

function render(moveFocus = false) {
  const count = saved.done + Number(saved.review) + Number(saved.flag);
  $("progress").value = count;
  $("progress-label").textContent = count + " of " + total + " activities complete";
  renderNavigation();
  if (step < missions.length) renderCommand();
  else if (step === missions.length) renderReview();
  else renderFlag();
  updateTerminal();
  if (moveFocus) $("lesson-title").focus();
}

function stepButtons() {
  return '<div class="actions">' +
    (step > 0 ? '<button class="secondary" type="button" id="previous">Previous</button>' : "") +
    (step < resumeStep() ? '<button class="primary" type="button" id="next">Continue</button>' : "") + "</div>";
}

function renderCommand() {
  const m = missions[step];
  const done = step < saved.done;
  const unlocked = done || saved.unlocked;
  lesson.innerHTML = '<p class="eyebrow">' + m.chapter + " / COMMAND " + (step + 1) + " OF " + missions.length + '</p>' +
    '<h2 id="lesson-title" tabindex="-1">' + m.title + '</h2><p>' + m.description + '</p>' +
    '<p class="task"><strong>Your task</strong><br>' + m.task + '</p>' +
    '<form id="question-form">' + choices(m.question, [m.command, m.wrongA, m.wrongB], (step + 1) % 3, "choice", unlocked) +
    (unlocked ? "" : '<button class="primary" type="submit">Check answer</button>') + '</form>' +
    '<p class="feedback" id="feedback" role="status"></p>' +
    (unlocked ? '<div class="syntax"><strong>' + (done ? "Command complete" : "Command unlocked") + '</strong>' +
      '<p><code>' + escapeHtml(m.command) + '</code></p><p>' + m.syntax + '</p>' +
      (done ? '<p>' + m.result + '</p><button class="secondary" id="show-result" type="button">Show terminal result</button>' :
        '<button class="secondary" id="insert" type="button">Put command in terminal</button>') + '</div>' : "") +
    stepButtons();
  $("question-form").addEventListener("submit", event => {
    event.preventDefault();
    const selected = new FormData(event.currentTarget).get("choice");
    if (selected === null) return setFeedback("Choose one answer first.", false);
    if (Number(selected) !== (step + 1) % 3) return setFeedback("Try again. Match the action and the target in the task above.", false);
    saved.unlocked = true;
    persist();
    render();
    setFeedback("Correct. Read the syntax below, then run the command in the terminal.", true);
    $("insert").focus();
  });
  $("insert")?.addEventListener("click", () => {
    input.value = m.command;
    input.focus();
  });
  $("show-result")?.addEventListener("click", () => {
    const { prompt, result } = transcript[step];
    print(prompt, m.command, result);
  });
}

function renderReview() {
  lesson.innerHTML = '<p class="eyebrow">FINAL QUESTIONS</p><h2 id="lesson-title" tabindex="-1">Review the opening checks</h2>' +
    '<p>Choose one answer for each question.</p><form id="review-form">' +
    finalReview.map(({ question, correct, wrongA, wrongB }, index) =>
      choices((index + 1) + ". " + question, [correct, wrongA, wrongB], (index + 2) % 3, "review-" + index, saved.review)
    ).join("") + (saved.review ? "" : '<button class="primary" type="submit">Check final answers</button>') +
    '</form><p id="feedback" class="feedback" role="status"></p>' + stepButtons();
  if (saved.review) setFeedback("Review complete. Continue to submit the flag.", true);
  $("review-form").addEventListener("submit", event => {
    event.preventDefault();
    const answers = new FormData(event.currentTarget);
    const index = finalReview.findIndex((_, i) => answers.get("review-" + i) !== String((i + 2) % 3));
    if (index !== -1) return setFeedback("Recheck question " + (index + 1) + ". " + finalReview[index].explanation, false);
    saved.review = true;
    persist();
    render();
    $("next").focus();
  });
}

function renderFlag() {
  lesson.innerHTML = '<p class="eyebrow">FLAG SUBMISSION</p><h2 id="lesson-title" tabindex="-1">' +
    (saved.flag ? "Room complete" : "Submit the opening flag") + '</h2>' +
    (saved.flag ? '<p>You completed the 28 commands, the final questions and the flag trail.</p>' :
      '<p>Enter the whole flag from Command 28, including both braces. If you need to see it again, click Previous twice, then Show terminal result.</p>' +
      '<form id="flag-form" class="stack"><label for="flag-entry">Opening flag</label><input type="text" id="flag-entry" placeholder="CEDAR{...}" autocomplete="off" spellcheck="false" required>' +
      '<button class="primary" type="submit">Check flag</button></form>') +
    '<p id="feedback" class="feedback" role="status"></p>' + stepButtons();
  $("flag-form")?.addEventListener("submit", event => {
    event.preventDefault();
    if ($("flag-entry").value.trim() !== FLAG) return setFeedback("Check the capital letters, underscore and braces against the terminal output.", false);
    saved.flag = true;
    persist();
    render(true);
  });
}

function updateTerminal() {
  const canRun = step === saved.done && step < missions.length && saved.unlocked;
  input.value = "";
  input.disabled = !canRun;
  $("run").disabled = !canRun;
  $("connection").textContent = session.connected ? "Remote session · cedar" : "Local session";
  $("prompt").textContent = session.prompt;
  $("terminal-status").textContent = canRun ? "Type the unlocked command and press Enter or Run." :
    step < saved.done ? "This command is complete. Use Show terminal result to read its output again." :
      step < missions.length ? "Answer the question to unlock the terminal." : "Terminal practice complete.";
}

function print(prompt, command, result) {
  output.textContent += "\n\n" + prompt + " " + command + (result ? "\n" + result : "");
  output.scrollTop = output.scrollHeight;
}

$("terminal-form").addEventListener("submit", event => {
  event.preventDefault();
  if (step !== saved.done || !saved.unlocked || step >= missions.length) return;
  const value = input.value.trim();
  if (value !== missions[step].command) {
    $("terminal-status").textContent = "Match the shown command exactly. Check the spaces, quotes and capital letters.";
    input.focus();
    return;
  }
  const prompt = session.prompt;
  let result;
  try {
    result = session.execute(value);
  } catch (error) {
    $("terminal-status").textContent = error.message;
    return;
  }
  transcript.push({ prompt, result });
  print(prompt, value, result);
  saved.done++;
  saved.unlocked = false;
  persist();
  render();
  $("next").focus();
});

lesson.addEventListener("click", event => {
  if (event.target.id === "previous") step--;
  else if (event.target.id === "next") step++;
  else return;
  render(true);
});

$("chapters").addEventListener("click", event => {
  const target = event.target.closest("button[data-step]");
  if (!target || target.disabled) return;
  const start = Number(target.dataset.step);
  const end = chapterStarts.find(value => value > start) ?? missions.length;
  step = saved.done >= start && saved.done < end ? saved.done : start;
  render(true);
});

$("start").addEventListener("click", () => {
  step = resumeStep();
  render();
});

$("reset").addEventListener("click", () => {
  if (!confirm("Reset all progress for this practice room?")) return;
  saved = { ...freshProgress };
  step = 0;
  session = createSession();
  transcript.length = 0;
  output.textContent = "Cedar training terminal ready.";
  persist();
  render(true);
});
render();
