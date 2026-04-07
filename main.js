const navLinks = document.querySelectorAll(".ul-list li a");
const sections = document.querySelectorAll("section");

function removeActive() {
  document
    .querySelectorAll(".ul-list li:not(.theme-toggle-btn)")
    .forEach((li) => li.classList.remove("active"));
}

navLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const targetId = link.getAttribute("href").substring(1);
    const targetSection = document.getElementById(targetId);

    window.scrollTo({
      top: targetSection.offsetTop - 80,
      behavior: "smooth",
    });

    removeActive();
    link.parentElement.classList.add("active");
  });
});

window.addEventListener("scroll", () => {
  let scrollPos = window.scrollY + 200;

  sections.forEach((section) => {
    if (
      scrollPos >= section.offsetTop &&
      scrollPos < section.offsetTop + section.offsetHeight
    ) {
      removeActive();
      const activeLink = document.querySelector(
        `.ul-list li a[href="#${section.id}"]`
      );
      if (
        activeLink &&
        !activeLink.parentElement.classList.contains("theme-toggle-btn")
      ) {
        activeLink.parentElement.classList.add("active");
      }
    }
  });

  if (window.scrollY > 500) {
    backToTop.style.display = "flex";
  } else {
    backToTop.style.display = "none";
  }

  revealElements.forEach((el) => {
    const windowHeight = window.innerHeight;
    const elementTop = el.getBoundingClientRect().top;
    const revealPoint = 150;

    if (elementTop < windowHeight - revealPoint) {
      el.classList.add("active-reveal");
    }
  });
});

const revealElements = document.querySelectorAll(
  ".about-container, .projects-container, .skills-container, .contact-content"
);
revealElements.forEach((el) => el.classList.add("reveal"));

const backToTop = document.createElement("div");
backToTop.innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
backToTop.id = "back-to-top";
document.body.appendChild(backToTop);

backToTop.style.cssText = `
  position: fixed;
  bottom: 40px;
  right: 40px;
  background: #474af0;
  color: white;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: none;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1000;
  transition: transform 0.3s ease;
`;

backToTop.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

backToTop.addEventListener(
  "mouseover",
  () => (backToTop.style.transform = "scale(1.2)")
);
backToTop.addEventListener(
  "mouseout",
  () => (backToTop.style.transform = "scale(1)")
);

const cards = document.querySelectorAll(".project-card, .c1, .skill-card");
cards.forEach((card) => {
  card.addEventListener(
    "mouseenter",
    () => (card.style.transform = "translateY(-8px) scale(1.05)")
  );
  card.addEventListener(
    "mouseleave",
    () => (card.style.transform = "translateY(0) scale(1)")
  );
});

const typingElement = document.querySelector(".info-home h3");
const words = [
  "Frontend Developer",
  "UI/UX Designer",
  "Web Enthusiast",
  "React Developer",
];
let wordIndex = 0;
let charIndex = 0;
let isDeleting = false;
let typingSpeed = 100;

function type() {
  const currentWord = words[wordIndex];
  let displayedText = currentWord.substring(0, charIndex);

  typingElement.innerHTML = displayedText + '<span class="cursor">|</span>';

  if (!isDeleting && charIndex < currentWord.length) {
    charIndex++;
    setTimeout(type, typingSpeed);
  } else if (isDeleting && charIndex > 0) {
    charIndex--;
    setTimeout(type, typingSpeed / 2);
  } else {
    isDeleting = !isDeleting;
    if (!isDeleting) {
      wordIndex = (wordIndex + 1) % words.length;
    }
    setTimeout(type, 1000);
  }
}

document.addEventListener("DOMContentLoaded", type);

// Theme Toggle Functionality
const themeToggle = document.getElementById("theme-toggle");
const body = document.body;
const portfolioImg = document.getElementById("portfolio-img");

// Check for saved theme preference or default to 'dark' mode
const currentTheme = localStorage.getItem("theme") || "dark";
if (currentTheme === "dark") {
  body.classList.add("dark-mode");
  themeToggle.querySelector("i").classList.replace("fa-moon", "fa-sun");
  if (portfolioImg) portfolioImg.src = "images/cp.png";
} else {
  if (portfolioImg) portfolioImg.src = "images/cp2.png";
}

themeToggle.addEventListener("click", () => {
  body.classList.toggle("dark-mode");
  
  // Update icon
  const icon = themeToggle.querySelector("i");
  if (body.classList.contains("dark-mode")) {
    icon.classList.replace("fa-moon", "fa-sun");
    localStorage.setItem("theme", "dark");
    if (portfolioImg) portfolioImg.src = "images/cp.png";
  } else {
    icon.classList.replace("fa-sun", "fa-moon");
    localStorage.setItem("theme", "light");
    if (portfolioImg) portfolioImg.src = "images/cp2.png";
  }
});document.addEventListener("DOMContentLoaded", () => {
  const loadingText = document.getElementById("loading-text");
  const mainIcon = document.querySelector(".main-icon");
  const subIcons = document.querySelectorAll(".sub-icons i");
  const designerText = document.getElementById("designer-text");
  const mainPage = document.getElementById("main-page");
  const loadingScreen = document.getElementById("loading-screen");

  function showElement(element, delay = 0) {
    setTimeout(() => {
      element.classList.remove("hidden");
      element.classList.add("fall");
    }, delay);
  }

  showElement(loadingText, 0);
  showElement(mainIcon, 800);
  subIcons.forEach((icon, idx) => {
    showElement(icon, 1600 + idx * 400);
  });
  showElement(designerText, 2800);

  setTimeout(() => {
    loadingScreen.style.opacity = "0";
    setTimeout(() => {
      loadingScreen.style.display = "none";
      // Scroll to top after loading screen
      window.scrollTo(0, 0);
    }, 500);
    if (mainPage) mainPage.classList.add("visible");
  }, 4000);
});
