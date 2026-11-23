"use strict";

const HOME = "/home/learner";
const FLAG = "CEDAR{OPENING_CHECKED}";

function createSession() {
  const entries = new Map();
  const addDirectory = path => entries.set(path, { directory: true, mode: "rwxr-xr-x" });
  const addFile = (path, content, mode = "rw-r--r--", size) =>
    entries.set(path, { content, mode, size: size ?? new TextEncoder().encode(content).length });

  [
    "/", "/etc", "/home", HOME, "/tmp", "/var", "/var/log",
    HOME + "/challenge", HOME + "/challenge/drawer", HOME + "/reports"
  ].forEach(addDirectory);
  addFile(HOME + "/.profile", "# Cedar training shell\n");
  addFile(HOME + "/reports/catalog.txt", "Cedar catalog export\n", "rw-r--r--", 8192);
  addFile(HOME + "/staff.txt", "Opening rota: Avery and Sam\n", "rw-------");
  addFile("/etc/cedar.conf", "branch=cedar\nmode=training\n");
  addFile("/var/log/opening.log", "08:00 Catalog loaded\n08:03 Reading room checked\n08:05 Front desk ready\n");
  addFile(HOME + "/challenge/.trail", "Follow drawer/opening.txt and keep the braces.\n");
  addFile(HOME + "/challenge/drawer/opening.txt", FLAG + "\n");

  let connected = false;
  let cwd = HOME;

  function resolve(path) {
    return path.startsWith("/") ? path : cwd + "/" + path;
  }

  function file(path) {
    const entry = entries.get(path);
    if (!entry || entry.directory) throw new Error("File not found: " + path);
    return entry;
  }

  function directory(path) {
    if (!entries.get(path)?.directory) throw new Error("Directory not found: " + path);
  }

  function sizeLabel(size, human) {
    if (human && size >= 1024) return (size / 1024).toFixed(1) + "K";
    return String(size);
  }

  function formatEntry(name, entry, human) {
    const type = entry.directory ? "d" : "-";
    return type + entry.mode + "  learner library  " + sizeLabel(entry.size ?? 4096, human) + "  " + name;
  }

  function list(path, options) {
    const entry = entries.get(path);
    if (!entry) throw new Error("Path not found: " + path);
    const detailed = options.includes("l");
    const human = options.includes("h");
    if (!entry.directory) return detailed ? formatEntry(path.split("/").pop(), entry, human) : path;
    const prefix = path === "/" ? "/" : path + "/";
    const all = options.includes("a");
    const children = [...entries].filter(([key]) =>
      key.startsWith(prefix) && key !== path && !key.slice(prefix.length).includes("/"))
      .map(([key, value]) => [key.slice(prefix.length), value])
      .filter(([name]) => all || !name.startsWith("."))
      .sort(([a], [b]) => a.localeCompare(b, "en"));
    if (all) {
      const parent = entries.get(path.slice(0, path.lastIndexOf("/")) || "/");
      children.unshift([".", entry], ["..", parent]);
    }
    if (detailed) return children.map(([name, value]) => formatEntry(name, value, human)).join("\n");
    return children.map(([name]) => name).join("  ");
  }

  // Only the listed classroom command forms reach this interpreter.
  function execute(command) {
    if (command === "ssh learner@cedar.example") {
      connected = true;
      return "Simulated connection established to cedar.example as learner.";
    }
    if (!connected) throw new Error("Complete the remote session step first.");

    const [program, first, second, third] = command.split(" ");
    switch (program) {
      case "whoami": return "learner";
      case "hostname": return "cedar";
      case "pwd": return cwd;
      case "id": return "uid=1000(learner) gid=1000(library) groups=1000(library)";
      case "man": return "NAME\n    ls - list directory contents\n\nSYNOPSIS\n    ls [OPTION]... [FILE]...\n\nDESCRIPTION\n    List information about files and directories.\n    See ls --help for a short option list.";
      case "ls": {
        if (first === "--help") return "Usage: ls [OPTION]... [FILE]...\n  -a   include names beginning with .\n  -l   use a long listing format\n  -h   use readable sizes with -l";
        const options = first?.startsWith("-") ? first : "";
        const argument = options ? second : first;
        return list(argument ? resolve(argument) : cwd, options);
      }
      case "mkdir": {
        const path = resolve(first);
        addDirectory(path);
        return "Practice folder created.";
      }
      case "touch": {
        const path = resolve(first);
        directory(path.slice(0, path.lastIndexOf("/")));
        if (!entries.has(path)) addFile(path, "");
        return "Practice file ready.";
      }
      case "echo": {
        const [, sentence, target] = /^echo "([^"]+)" > (.+)$/.exec(command);
        const path = resolve(target);
        addFile(path, sentence + "\n", file(path).mode);
        return "";
      }
      case "cp":
        entries.set(resolve(second), { ...file(resolve(first)) });
        return "";
      case "mv": {
        const source = resolve(first);
        entries.set(resolve(second), file(source));
        entries.delete(source);
        return "";
      }
      case "cat": return file(resolve(first)).content.trimEnd();
      case "head": return file(resolve(third)).content.split("\n").slice(0, Number(second)).join("\n");
      case "chmod": {
        const entry = file(resolve(second));
        entry.mode = entry.mode.slice(0, 3) + "r" + entry.mode.slice(4);
        return "";
      }
      case "cd": {
        const path = resolve(first);
        directory(path);
        cwd = path;
        return "";
      }
      default: throw new Error("This command is outside the lesson’s practice set.");
    }
  }

  return {
    execute,
    get connected() { return connected; },
    get prompt() { return "learner@" + (connected ? "cedar" : "desk") + ":" + cwd.replace(HOME, "~") + "$"; }
  };
}
