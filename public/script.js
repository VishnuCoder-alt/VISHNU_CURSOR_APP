document.getElementById("userInput").addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault(); // prevent newline if it's a textarea
      sendQuery();
    }
  });
  


async function sendQuery() {
    const input = document.getElementById("userInput");
    const output = document.getElementById("output");
    const actionLinks = document.getElementById("actionLinks");
    const query = input.value.trim();
  
    if (!query) return;
  
    // Show user input
    const userDiv = document.createElement("div");
    userDiv.textContent = `> ${query}`;
    userDiv.style.color = "#4fc3f7";
    userDiv.style.animation = "fadeIn 0.4s ease";
    output.appendChild(userDiv);
  
    // Loading animation
    const loading = document.createElement("div");
    loading.style.color = "#ccc";
    let dots = 0;
    const interval = setInterval(() => {
      dots = (dots + 1) % 4;
      loading.textContent = `🤖 Thinking${'.'.repeat(dots)}`;
    }, 500);
    output.appendChild(loading);
    output.scrollTop = output.scrollHeight;
  
    try {
      const res = await fetch("/runAgent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
  
      const data = await res.json();
      clearInterval(interval);
      output.removeChild(loading);
  
      data.result.split('\n').forEach(line => {
        const div = document.createElement("div");
        div.textContent = line;
        div.style.animation = "fadeIn 0.4s ease";
        if (line.includes("✅")) {
          div.style.color = "#81c784"; // success
        } else if (line.includes("❌")) {
          div.style.color = "#ef5350"; // error
        } else {
          div.style.color = "#fff176"; // info
        }
        output.appendChild(div);
      });
  
      // Handle folder for preview + download
      const folder = data.folder;
      if (folder && /^[a-zA-Z0-9_-]+$/.test(folder)) {
        actionLinks.innerHTML = `
          <a href="/preview/${folder}/index.html" target="_blank" style="margin-right: 20px; color:#4fc3f7;">🌐 Preview Site</a>
          <a href="/download/${folder}" style="color:#ffd54f;">⬇️ Download ZIP</a>
        `;
      } else {
        actionLinks.innerHTML = `<div style="color:#ef5350;">⚠️ Folder creation failed or invalid folder name</div>`;
      }
    } catch (error) {
      clearInterval(interval);
      output.removeChild(loading);
      const errorDiv = document.createElement("div");
      errorDiv.textContent = `❌ Error: ${error.message}`;
      errorDiv.style.color = "#ef5350";
      output.appendChild(errorDiv);
    }
  
    input.value = "";
    output.scrollTop = output.scrollHeight;
  }
  