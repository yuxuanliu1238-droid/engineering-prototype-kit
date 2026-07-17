const pages = [...document.querySelectorAll(".page")];
const navButtons = [...document.querySelectorAll("nav button")];
let record = null;

function showPage(pageId) {
  pages.forEach((page) => page.classList.toggle("active", page.id === pageId));
  navButtons.forEach((button) =>
    button.classList.toggle("active", button.dataset.page === pageId),
  );
}

function render() {
  const hasRecord = Boolean(record);
  document.querySelector("#record-empty").hidden = hasRecord;
  document.querySelector("#record-card").hidden = !hasRecord;
  document.querySelector("#admin-empty").hidden = hasRecord;
  document.querySelector("#admin-card").hidden = !hasRecord;
  if (!record) return;
  document.querySelector("#record-name").textContent = record.name;
  document.querySelector("#record-location").textContent = `发现地点：${record.location}`;
  document.querySelector("#admin-name").textContent = record.name;
  document.querySelector("#admin-location").textContent = `发现地点：${record.location}`;
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => showPage(button.dataset.page));
});

document.querySelector("#report-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.querySelector("#item-name").value.trim();
  const location = document.querySelector("#item-location").value.trim();
  const error = document.querySelector("#form-error");
  if (!name || !location) {
    error.textContent = "请填写物品名称和发现地点。";
    return;
  }
  error.textContent = "";
  record = { name, location, status: "pending" };
  render();
  showPage("records");
});

document.querySelector("#mark-received").addEventListener("click", () => {
  if (!record) return;
  record.status = "received";
  document.querySelector("#record-card .status").textContent = "运营已接收";
  document.querySelector("#admin-card .status").textContent = "已接收";
  document.querySelector("#mark-received").disabled = true;
  document.querySelector("#mark-received").textContent = "已接收";
});

render();
