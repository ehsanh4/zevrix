/* ============================================================
   ZEVRIX — Data (products, categories, features, etc.)
   ============================================================ */

const CATEGORIES = [
  { id: "software",    icon: "🧩", color: "#6d5dfc", gradient: ["#6d5dfc", "#00d4ff"] },
  { id: "vpn",         icon: "🌐", color: "#00b894", gradient: ["#00c9a7", "#0085ff"] },
  { id: "ai",          icon: "🤖", color: "#e056fd", gradient: ["#e056fd", "#7d5fff"] },
  { id: "sub",         icon: "📦", color: "#ff9f43", gradient: ["#ffa726", "#ff5252"] },
  { id: "games",       icon: "🎮", color: "#ee5253", gradient: ["#ff6b6b", "#c44569"] },
  { id: "files",       icon: "🗂️", color: "#00cec9", gradient: ["#00cec9", "#0984e3"] },
  { id: "security",    icon: "🛡️", color: "#ff6b6b", gradient: ["#ff7675", "#d63031"] },
  { id: "productivity",icon: "⚡", color: "#feca57", gradient: ["#feca57", "#ff9f43"] }
];

const PRODUCTS = [
  { id: 1, name: { fa: "لایسنس اصلی ویندوز ۱۱ پرو", en: "Windows 11 Pro License" }, cat: "software", icon: "🪟", price: 1900000, oldPrice: 3200000, rating: 4.9, reviews: 2143, sold: 8420, badge: { fa: "پرفروش", en: "Best Seller" }, featured: true,
    desc: { fa: "لایسنس رسمی و اورجینال ویندوز ۱۱ پرو برای یک دستگاه. فعال‌سازی آنلاین و تضمین دائمی.", en: "Official genuine Windows 11 Pro license for one device. Online activation with lifetime guarantee." },
    specs: { fa: ["یک دستگاه", "فعال‌سازی آنلاین", "گارانتی دائمی", "نسخه ۶۴ بیتی"], en: ["1 Device", "Online Activation", "Lifetime Warranty", "64-bit Version"] } },

  { id: 2, name: { fa: "اشتراک ۳ ماهه پریمیوم VPN", en: "3-Month Premium VPN" }, cat: "vpn", icon: "🛡️", price: 850000, oldPrice: 1400000, rating: 4.8, reviews: 1320, sold: 6210, badge: { fa: "محبوب", en: "Popular" }, featured: true,
    desc: { fa: "دسترسی نامحدود به بیش از ۹۰ کشور، سرعت بالا و رمزنگاری کامل ترافیک.", en: "Unlimited access to 90+ countries, high speed and full traffic encryption." },
    specs: { fa: ["۹۰+ کشور", "ترافیک نامحدود", "تا ۱۰ دستگاه", "بدون لاگ"], en: ["90+ Countries", "Unlimited Traffic", "Up to 10 Devices", "No Logs"] } },

  { id: 3, name: { fa: "اشتراک ماهانه ChatGPT Plus", en: "ChatGPT Plus Subscription" }, cat: "ai", icon: "🤖", price: 1250000, oldPrice: 1600000, rating: 4.9, reviews: 3412, sold: 11240, badge: { fa: "داغ", en: "Hot" }, featured: true,
    desc: { fa: "دسترسی به مدل‌های پیشرفته، اولویت در دسترسی و سرعت بالاتر در ساعات اوج.", en: "Access to advanced models, priority access and faster speeds during peak hours." },
    specs: { fa: ["مدل‌های پیشرفته", "دسترسی اولویت‌دار", "پاسخ سریع‌تر", "تحویل فوری"], en: ["Advanced Models", "Priority Access", "Faster Responses", "Instant Delivery"] } },

  { id: 4, name: { fa: "لایسنس اصلی Office 2024", en: "Office 2024 License" }, cat: "software", icon: "📄", price: 1650000, oldPrice: 2600000, rating: 4.7, reviews: 987, sold: 4530, featured: true,
    desc: { fa: "مجموعه کامل آفیس ۲۰۲۴ شامل Word، Excel، PowerPoint و بیشتر.", en: "Complete Office 2024 suite including Word, Excel, PowerPoint and more." },
    specs: { fa: ["یک دستگاه", "فعال‌سازی دائمی", "تمام برنامه‌ها", "پشتیبانی فارسی"], en: ["1 Device", "Lifetime Activation", "All Apps", "Persian Support"] } },

  { id: 5, name: { fa: "گیم‌تایم ۳ ماهه استیم", en: "Steam 3-Month Game Pass" }, cat: "games", icon: "🎮", price: 980000, oldPrice: 1500000, rating: 4.6, reviews: 765, sold: 3210, featured: true,
    desc: { fa: "دسترسی به صدها بازی محبوب استیم برای سه ماه کامل.", en: "Access to hundreds of popular Steam games for three full months." },
    specs: { fa: ["۳ ماه", "صدها بازی", "فعال‌سازی سریع", "حساب شما"], en: ["3 Months", "Hundreds of Games", "Quick Activation", "Your Account"] } },

  { id: 6, name: { fa: "آنتی‌ویروس پریمیوم ۱ ساله", en: "Premium Antivirus 1-Year" }, cat: "security", icon: "🦠", price: 720000, oldPrice: 1150000, rating: 4.7, reviews: 1432, sold: 5640, featured: true,
    desc: { fa: "محافظت کامل در برابر ویروس‌ها، باج‌افزارها و حملات آنلاین برای یک سال.", en: "Complete protection against viruses, ransomware and online attacks for one year." },
    specs: { fa: ["۱ سال", "تا ۳ دستگاه", "محافظت بلادرنگ", "فایروال"], en: ["1 Year", "Up to 3 Devices", "Real-time Protection", "Firewall"] } },

  { id: 7, name: { fa: "قالب حرفه‌ای فروشگاهی", en: "Pro Ecommerce Template" }, cat: "files", icon: "🎨", price: 540000, oldPrice: 900000, rating: 4.8, reviews: 421, sold: 1890, featured: true,
    desc: { fa: "قالب مدرن و واکنش‌گرا برای فروشگاه‌های آنلاین با کد تمیز و مستندات کامل.", en: "Modern responsive template for online stores with clean code and full docs." },
    specs: { fa: ["واکنش‌گرا", "کد تمیز", "مستندات کامل", "آپدیت رایگان"], en: ["Responsive", "Clean Code", "Full Docs", "Free Updates"] } },

  { id: 8, name: { fa: "اشتراک ۱ ساله فضای ابری", en: "1-Year Cloud Storage" }, cat: "sub", icon: "☁️", price: 1100000, oldPrice: 1800000, rating: 4.5, reviews: 654, sold: 2740, featured: true,
    desc: { fa: "۲ ترابایت فضای ابری امن با همگام‌سازی روی همه دستگاه‌ها.", en: "2TB of secure cloud storage with sync across all your devices." },
    specs: { fa: ["۲ ترابایت", "همگام‌سازی", "رمزنگاری", "۱ سال"], en: ["2TB", "Sync", "Encrypted", "1 Year"] } },

  { id: 9, name: { fa: "لایسنس Adobe Photoshop ۲۰۲۵", en: "Adobe Photoshop 2025" }, cat: "software", icon: "🖼️", price: 1450000, oldPrice: 2300000, rating: 4.9, reviews: 1788, sold: 6120, featured: true,
    desc: { fa: "قدرتمندترین ابزار ویرایش تصویر با قابلیت‌های هوش مصنوعی جدید.", en: "The most powerful image editing tool with new AI capabilities." },
    specs: { fa: ["هوش مصنوعی", "یک دستگاه", "آپدیت رایگان", "گارانتی"], en: ["AI Tools", "1 Device", "Free Updates", "Warranty"] } },

  { id: 10, name: { fa: "ابزار هوش مصنوعی تولید تصویر", en: "AI Image Generator" }, cat: "ai", icon: "✨", price: 690000, oldPrice: 990000, rating: 4.6, reviews: 932, sold: 3980,
    desc: { fa: "تولید تصاویر حرفه‌ای با هوش مصنوعی در چند ثانیه.", en: "Generate professional images with AI in seconds." },
    specs: { fa: ["تولید نامحدود", "کیفیت بالا", "استفاده آسان", "۱ ماه"], en: ["Unlimited", "High Quality", "Easy to Use", "1 Month"] } },

  { id: 11, name: { fa: "اشتراک اسپاتیفای پریمیوم", en: "Spotify Premium" }, cat: "sub", icon: "🎵", price: 430000, oldPrice: 650000, rating: 4.7, reviews: 2210, sold: 9870, badge: { fa: "محبوب", en: "Popular" },
    desc: { fa: "موسیقی بدون تبلیغات با کیفیت بالا و قابلیت دانلود آفلاین.", en: "Ad-free music in high quality with offline downloads." },
    specs: { fa: ["بدون تبلیغ", "دانلود آفلاین", "کیفیت بالا", "۱ ماه"], en: ["Ad-free", "Offline Downloads", "High Quality", "1 Month"] } },

  { id: 12, name: { fa: "مدیریت رمز عبور پریمیوم", en: "Premium Password Manager" }, cat: "security", icon: "🔑", price: 610000, oldPrice: 980000, rating: 4.8, reviews: 845, sold: 3120,
    desc: { fa: "نگهداری امن تمام رمزهای عبور با رمزنگاری نظامی.", en: "Securely store all your passwords with military-grade encryption." },
    specs: { fa: ["رمزنگاری نظامی", "تا ۵ دستگاه", "پر کردن خودکار", "۱ سال"], en: ["Military Encryption", "Up to 5 Devices", "Autofill", "1 Year"] } },

  { id: 13, name: { fa: "اشتراک ۱۲ ماهه VPN پریمیوم", en: "12-Month Premium VPN" }, cat: "vpn", icon: "🛡️", price: 2400000, oldPrice: 4200000, rating: 4.9, reviews: 4521, sold: 14200, badge: { fa: "بهترین قیمت", en: "Best Value" },
    desc: { fa: "یک سال کامل دسترسی نامحدود و امن با بالاترین سرعت.", en: "A full year of unlimited, secure access at maximum speed." },
    specs: { fa: ["۱۲ ماه", "نامحدود", "۹۰+ کشور", "تا ۱۰ دستگاه"], en: ["12 Months", "Unlimited", "90+ Countries", "Up to 10 Devices"] } },

  { id: 14, name: { fa: "بسته قالب‌های گرافیکی", en: "Graphic Template Bundle" }, cat: "files", icon: "🖌️", price: 760000, oldPrice: 1250000, rating: 4.5, reviews: 312, sold: 1240,
    desc: { fa: "بیش از ۲۰۰ قالب آماده برای طراحی‌های حرفه‌ای.", en: "Over 200 ready-made templates for professional designs." },
    specs: { fa: ["۲۰۰+ قالب", "فرمت‌های مختلف", "لایه‌باز", "آپدیت"], en: ["200+ Templates", "Multiple Formats", "Layered", "Updates"] } },

  { id: 15, name: { fa: "لایسنس ابزار بهره‌وری Notion", en: "Notion Productivity License" }, cat: "productivity", icon: "📝", price: 890000, oldPrice: 1350000, rating: 4.6, reviews: 1124, sold: 4310,
    desc: { fa: "مدیریت کامل پروژه‌ها، یادداشت‌ها و تیم‌ها در یک جا.", en: "Complete management of projects, notes and teams in one place." },
    specs: { fa: ["تیم نامحدود", "تمام قابلیت‌ها", "۱ سال", "همگام‌سازی"], en: ["Unlimited Team", "All Features", "1 Year", "Sync"] } },

  { id: 16, name: { fa: "گیفت کارت بازی ۵۰ دلاری", en: "$50 Game Gift Card" }, cat: "games", icon: "🎁", price: 2350000, oldPrice: 2600000, rating: 4.8, reviews: 1543, sold: 7210,
    desc: { fa: "گیفت کارت ۵۰ دلاری برای خرید بازی و محتوای درون‌بازی.", en: "$50 gift card for games and in-game content." },
    specs: { fa: ["۵۰ دلار", "تحویل آنی", "کد رسمی", "منطقه آزاد"], en: ["$50", "Instant Delivery", "Official Code", "Region Free"] } }
];

const FEATURES = [
  { icon: "🔒", title: { fa: "پرداخت امن", en: "Secure Payments" }, desc: { fa: "تمام تراکنش‌ها با رمزنگاری کامل و دروازه‌های پرداخت معتبر انجام می‌شوند.", en: "All transactions are fully encrypted through trusted payment gateways." } },
  { icon: "⚡", title: { fa: "تحویل آنی دیجیتال", en: "Instant Digital Delivery" }, desc: { fa: "محصولات بلافاصله پس از پرداخت به‌صورت آنلاین تحویل داده می‌شوند.", en: "Products are delivered online immediately after payment." } },
  { icon: "✅", title: { fa: "محصولات تأییدشده", en: "Verified Products" }, desc: { fa: "تمام محصولات اورجینال و توسط تیم ما بررسی و تأیید شده‌اند.", en: "All products are genuine, reviewed and verified by our team." } },
  { icon: "🎧", title: { fa: "پشتیبانی مشتری", en: "Customer Support" }, desc: { fa: "تیم پشتیبانی ما در تمام ساعات شبانه‌روز پاسخگوی شماست.", en: "Our support team is available around the clock, 24/7." } },
  { icon: "↩️", title: { fa: "بازگشت وجه", en: "Money-Back Guarantee" }, desc: { fa: "در صورت بروز مشکل، تا زمان مشخصی امکان بازگشت وجه وجود دارد.", en: "If something goes wrong, a refund is available within a set period." } },
  { icon: "💎", title: { fa: "بهترین قیمت", en: "Best Prices" }, desc: { fa: "قیمت‌های رقابتی همراه با تخفیف‌های ویژه و دائمی روی محصولات.", en: "Competitive prices with special, ongoing discounts on products." } }
];

const TESTIMONIALS = [
  { name: "آرش محمدی", role: { fa: "برنامه‌نویس", en: "Developer" }, avatar: "آ", rating: 5, color: "#6d5dfc",
    text: { fa: "لایسنس ویندازم رو کمتر از ۵ دقیقه تحویل گرفتم. سرعت تحویل واقعاً عالیه و پرداخت کاملاً امن بود.", en: "I received my Windows license in under 5 minutes. Delivery speed is amazing and payment was fully secure." } },
  { name: "Sara Karimi", role: { fa: "طراح گرافیک", en: "Graphic Designer" }, avatar: "S", rating: 5, color: "#e056fd",
    text: { fa: "بهترین تجربه خرید آنلاین رو داشتم. محصولات کاملاً اورجینال هستن و پشتیبانی سریع جواب میده.", en: "I had the best online shopping experience. Products are fully genuine and support replies fast." } },
  { name: "رضا اکبری", role: { fa: "گیمر", en: "Gamer" }, avatar: "ر", rating: 5, color: "#ee5253",
    text: { fa: "گیفت کارت استیم رو خریدم و کد بلافاصله ارسال شد. دیگه نیازی به سایت‌های خارجی ندارم.", en: "Bought a Steam gift card and the code was sent instantly. No need for foreign sites anymore." } },
  { name: "Niloofar Ahmadi", role: { fa: "مدیر محصول", en: "Product Manager" }, avatar: "N", rating: 5, color: "#00b894",
    text: { fa: "فرآیند خرید خیلی ساده و سریع بود. دقیقاً همون چیزی که برای محصولات دیجیتال لازم داریم.", en: "The checkout process was simple and fast. Exactly what you need for digital products." } },
  { name: "محمد حسینی", role: { fa: "استارتاپر", en: "Entrepreneur" }, avatar: "م", rating: 5, color: "#ff9f43",
    text: { fa: "چندین بار از این فروشگاه خرید کردم و همیشه راضی بودم. ضمانت بازگشت وجه خیالم رو راحت کرده.", en: "I've purchased here several times and I'm always satisfied. The money-back guarantee gives peace of mind." } },
  { name: "Pouya Sadeghi", role: { fa: "علاقه‌مند به تکنولوژی", en: "Tech Enthusiast" }, avatar: "P", rating: 5, color: "#00cec9",
    text: { fa: "تنوع محصولات دیجیتال خیلی زیاده و قیمت‌ها منصفانه‌ست. پشتیبانی ۲۴ ساعته واقعاً کار می‌کنه.", en: "Huge variety of digital products and fair prices. 24/7 support really works." } }
];

const FAQS = [
  { q: { fa: "محصولات چگونه تحویل داده می‌شوند؟", en: "How are products delivered?" },
    a: { fa: "تمام محصولات دیجیتال بلافاصله پس از پرداخت موفق، به‌صورت آنلاین و از طریق صفحه سفارش و ایمیل تحویل داده می‌شوند.", en: "All digital products are delivered online immediately after successful payment, via your order page and email." } },
  { q: { fa: "آیا پرداخت امن است؟", en: "Is the payment secure?" },
    a: { fa: "بله، تمام تراکنش‌ها از طریق دروازه‌های پرداخت معتبر و با رمزنگاری SSL انجام می‌شوند. اطلاعات کارت شما هرگز ذخیره نمی‌شود.", en: "Yes, all transactions go through trusted payment gateways with SSL encryption. Your card details are never stored." } },
  { q: { fa: "آیا امکان بازگشت وجه وجود دارد؟", en: "Is there a refund option?" },
    a: { fa: "در صورت بروز مشکل در محصول یا عدم تطابق، تا ۷ روز امکان درخواست بازگشت وجه وجود دارد.", en: "If there's an issue with the product, you can request a refund within 7 days." } },
  { q: { fa: "بعد از پرداخت چه اتفاقی می‌افتد؟", en: "What happens after payment?" },
    a: { fa: "بلافاصله پس از پرداخت، محصول به صفحه سفارش شما اضافه شده و یک کپی نیز برای شما ایمیل می‌شود.", en: "Right after payment, the product is added to your order page and a copy is emailed to you." } },
  { q: { fa: "چگونه با پشتیبانی تماس بگیرم؟", en: "How do I contact support?" },
    a: { fa: "از طریق بخش پشتیبانی سایت، ایمیل support@digitalstore.com یا چت آنلاین در تمام ساعات می‌توانید با ما در ارتباط باشید.", en: "You can reach us anytime via the support section, support@digitalstore.com, or live chat." } },
  { q: { fa: "آیا محصولات دارای گارانتی هستند؟", en: "Are the products guaranteed?" },
    a: { fa: "بله، تمام محصولات اورجینال بوده و گارانتی رسمی دارند. در صورت بروز مشکل، تعویض یا بازگشت وجه انجام می‌شود.", en: "Yes, all products are genuine with an official warranty. If an issue arises, replacement or refund is provided." } }
];
