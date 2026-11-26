import { SeedlingItem } from '../types';

export const SEEDLINGS: SeedlingItem[] = [
  {
    id: 'pomidor',
    name: "Pomidor ko'chati",
    category: 'Sabzavot',
    shortDescription:
      "Issiqsevar va quyoshli maydonlarda tez rivojlanadi. To'g'ri sug'orish va shamollatish hosildorlikni oshiradi.",
    image: '/src/assets/images/seedling_tomato_1795607604110.jpg',
    season: 'Aprel – May (ochiq dalaga), Fevral – Mart (issiqxonaga)',
    temperature: '20–26 °C (kechasi 15 °C dan past bo‘lmasligi kerak)',
    sunlight: 'Kuniga kamida 6–8 soat to‘g‘ridan-to‘g‘ri quyosh nuri',
    soil: 'Yengil qumoq, chirindiga boy, pH 6.0–6.8 bo‘lgan unumdor tuproq',
    watering: 'Ildiz ostidan haftasiga 2–3 marta iliq suv bilan (barglarga tegizmasdan)',
    fertilizer: 'Ekishdan 14 kun o‘tib azotli, gullash davrida fosfor-kaliyli o‘g‘it',
    spacing: 'Qator orasi 60–70 sm, ko‘chat orasi 35–40 sm',
    harvest: 'Ko‘chat o‘tqazilgandan 60–75 kun o‘tib birinchi hosil',
    overview:
      "Pomidor ko'chatini ko'chirib o'tqazishdan oldin 7–10 kun davomida ochiq havoga chiniqtirish zarur. Ekishda poyaning pastki qismini 3–5 sm chuqurroq ko'mish qo'shimcha ildizlar chiqishiga yordam beradi. Birinchi gullar paydo bo'lganda pastki sarg'aygan barglarni olib tashlash havo aylanishini yaxshilaydi.",
    preventionSummary: [
      "Barglarga suv sepishdan saqlaning — faqat ildiz ostidan ertalab sug'oring.",
      "Ko'chatlarni haddan tashqari zich ekmang, oraliq masofaga qat'iy amal qiling.",
      "Bir joyga ketma-ket 2 yil pomidor yoki kartoshka ekmang (almashlab ekish).",
      "Har 10–14 kunda biologik fungitsid (masalan, Fitosporin) bilan profilaktika qiling.",
    ],
    diseases: [
      {
        name: 'Fitoftoroz (Kechki chirish)',
        symptoms: "Barglarda to'q qo'ng'ir dog'lar va pastki tomonida oqish g'ubor paydo bo'ladi.",
        prevention: "Issiqxonada namlikni 70% dan oshirmaslik, mis saqlovchi preparatlar bilan oldindan purkash.",
      },
      {
        name: 'Un-shudring kasalligi',
        symptoms: "Barg yuzasida unga o'xshash oq qatlam hosil bo'lib, barg quriydi.",
        prevention: "Kechki sug'orishni to'xtatish va oltingugurt asosli biologik vositalar qo'llash.",
      },
    ],
  },
  {
    id: 'bodring',
    name: "Bodring ko'chati",
    category: 'Sabzavot',
    shortDescription:
      "Namlik va iliqlikni xush ko'radigan nozik ildizli ekin. Ildiziga shikast yetkazmasdan ekish juda muhim.",
    image: '/src/assets/images/seedling_cucumber_1795607605251.jpg',
    season: 'Aprel oxiri – May (tuproq 15 °C dan qiziganda)',
    temperature: '22–28 °C kunduzi, 17–19 °C kechasi',
    sunlight: 'Yorug‘ joy, tushki jaziramada yengil soya foydali',
    soil: 'Namlikni yaxshi ushlaydigan, g‘ovak va chirindili tuproq (pH 6.2–7.0)',
    watering: 'Tez-tez, har 2–3 kunda iliq (22–24 °C) suv bilan sug‘orish',
    fertilizer: 'Har 10–12 kunda organik chiritma yoki kaliy-azotli eritma',
    spacing: 'Qator orasi 70–80 sm, o‘simlik orasi 25–30 sm',
    harvest: 'Ekishdan 40–50 kun o‘tib muntazam terim boshlanadi',
    overview:
      "Bodring ko'chatining ildiz tizimi juda nozik bo'lgani uchun uni torfli tuvakchada yetishtirish va tuproq bo'lagi bilan ko'chirib o'tqazish eng yaxshi natija beradi. Sovuq suv bilan sug'orish ildiz chirishiga olib keladi, shuning uchun suv albatta quyoshda ilitilgan bo'lishi kerak.",
    preventionSummary: [
      "Hech qachon muzdek quduq yoki vodoprovod suvi bilan sug'ormang.",
      "Tuproq yuzasini somon yoki quruq o't bilan mulchalash namlikni saqlaydi va ildizni himoyalaydi.",
      "O'rgimchakkana va shira hasharotlariga qarshi barg ostini muntazam tekshiring.",
      "Palaklarni shpaler (ip) ga ko'tarib bog'lash chirish xavfini keskin kamaytiradi.",
    ],
    diseases: [
      {
        name: 'Soxta un-shudring (Peronosporoz)',
        symptoms: "Barg ustida sarg'ish burchakli dog'lar, ostida esa kulrang-binafsha g'ubor.",
        prevention: "Namlik keskin o'zgarishiga yo'l qo'ymaslik, profilaktik fungitsid sepish.",
      },
      {
        name: 'Ildiz chirishi',
        symptoms: "Issiq kunda ham barglar so'lib, poyaning yer bilan tutash qismi qorayadi.",
        prevention: "Iliq suv bilan sug'orish, tuproqni ortiqcha botqoqlantirmaslik, Trikhodermin qo'llash.",
      },
    ],
  },
  {
    id: 'olma',
    name: "Olma ko'chati",
    category: 'Mevali daraxt',
    shortDescription:
      "Ko'p yillik mevali bog' asosi. Payvandlangan joyini tuproqdan yuqorida qoldirib ekish sog'lom o'sish garovi.",
    image: '/src/assets/images/seedling_apple_1795607605227.jpg',
    season: 'Erta bahor (Mart) yoki kech kuz (Noyabr, barg to‘kilgach)',
    temperature: '-25 °C gacha chidamli, gullashda +15–22 °C ideal',
    sunlight: 'To‘liq quyoshli, shamoldan himoyalangan ochiq maydon',
    soil: 'Chuqur haydalgan, yer osti suvlari 1.5 m dan chuqur qumloq-bo‘z tuproq',
    watering: 'Birinchi yili har 10–14 kunda chuqur sug‘orish (15–20 litr)',
    fertilizer: 'Ekish chuquriga chirigan go‘ng va superfosfat; bahorda azotli oziqlantirish',
    spacing: 'Kuchli o‘suvchi 4×5 m, pakana payvandtag 1.5×3.5 m',
    harvest: 'Pakana navlar 2–3 yilda, oddiy navlar 4–5 yilda hosilga kiradi',
    overview:
      "Olma ko'chati ekishdan oldin chuqurni (60×60 sm) kamida 2 hafta avval tayyorlab, o'g'itlangan unumdor tuproq solish tavsiya etiladi. Ko'chatning ildiz bo'g'zi yer sathidan 3–4 sm balandda qolishi shart, aks holda po'stloq chirishi mumkin.",
    preventionSummary: [
      "Bahor va kuzda daraxt tanasini ohak eritmasi bilan oqlab, quyosh kuyishi va zararkunandalardan saqlang.",
      "Kurtaklar uyg'onishidan oldin 3% li Bordo suyuqligi bilan yuvib chiqing.",
      "Kuzda to'kilgan barcha barglarni yig'ib yo'q qiling — zamburug' sporalari shu yerda qishlaydi.",
      "Har bahorda shakl beruvchi va sanitar butash o'tkazing.",
    ],
    diseases: [
      {
        name: 'Parsha (Qora dog‘lanish)',
        symptoms: "Barg va mevalarda zaytun-qora tusli qattiq dog'lar paydo bo'ladi.",
        prevention: "Bahorgi kurtak ochilishidan oldin va gullashdan keyin mis preparatlari purkash.",
      },
      {
        name: 'Olma qurti va shira',
        symptoms: "Uchki yosh barglar buralib qoladi, meva ichida qurt izlari uchraydi.",
        prevention: "Tutqich belbog'lar qo'yish va zararkunandalarga qarshi o'z vaqtida ishlov berish.",
      },
    ],
  },
  {
    id: 'uzum',
    name: "Uzum ko'chati",
    category: 'Tokzor',
    shortDescription:
      "O'zbekiston iqlimiga juda mos serhosil o'simlik. Quyoshli janubiy yonbag'ir va drenajli tuproqda zo'r o'sadi.",
    image: '/src/assets/images/seedling_grape_1795607605770.jpg',
    season: 'Erta bahor (Mart – Aprel boshi) yoki kuz (Oktabr – Noyabr)',
    temperature: 'O‘sish uchun 22–32 °C, qishda ko‘miladigan navlarda muhofaza zarur',
    sunlight: 'Maksimal quyosh nuri — soyada shakar miqdori kamayadi',
    soil: 'G‘ovak, suvni yaxshi o‘tkazadigan toshloq-qumloq yoki bo‘z tuproq',
    watering: 'Kam, lekin chuqur: gullashdan oldin va g‘o‘ra kattalashganda',
    fertilizer: 'Kuzda fosfor-kaliy va chirigan go‘ng, bahorda ozroq azot',
    spacing: 'Qator orasi 2.5–3 m, tok orasi 1.5–2 m',
    harvest: '3-yildan to‘liq hosil bera boshlaydi',
    overview:
      "Uzum ko'chati ekilganda ildizlar 40–50 sm chuqurlikka tushirilishi kerak, bu qurg'oqchilikka chidamlilikni oshiradi. Birinchi yili 1–2 ta baquvvat novda qoldirib, qolgan ortiqcha novdalarni olib tashlash kelajakdagi tok shaklini to'g'ri shakllantiradi.",
    preventionSummary: [
      "Tok novdalarini o'z vaqtida xomtok (ortiqcha novda va barglarni siyraklash) qiling.",
      "Gullash arafasida va g'o'ralar no'xatdek bo'lganda oltingugurt bilan ishlov bering.",
      "Pishish davrida sug'orishni to'xtating — aks holda mevalar yorilib chiriydi.",
      "Qishki sovuqdan oldin ko'miladigan navlarni quruq tuproq bilan ko'ming.",
    ],
    diseases: [
      {
        name: 'Oidium (Kulrang un-shudring)',
        symptoms: "Barg va yosh mevalarda kulrang chang qoplamasi, keyin meva yoriladi.",
        prevention: "Kolloid oltingugurt purkash va tok orasini yaxshi shamollatish.",
      },
      {
        name: 'Mildyu (Soxta un-shudring)',
        symptoms: "Barg ustida yog'li sariq dog'lar, ostida oq momiq g'ubor.",
        prevention: "Bordo suyuqligi yoki tizimli fungitsidlar bilan oldindan profilaktika.",
      },
    ],
  },
  {
    id: 'qalampir',
    name: "Qalampir ko'chati",
    category: 'Sabzavot',
    shortDescription:
      "Issiqni va barqaror namlikni sevuvchi ko'chat. Yirik va etli hosil olish uchun ildizni kislorod bilan ta'minlang.",
    image: '/src/assets/images/seedling_pepper_1795607605850.jpg',
    season: 'May oyi (sovuq xavfi to‘liq o‘tgandan keyin)',
    temperature: '22–27 °C ideal, 13 °C dan pastda o‘sish to‘xtaydi',
    sunlight: 'Yorqin quyosh nuri, shamoldan pana joy',
    soil: 'Yengil, unumdor, yumshoq tuproq (pH 6.0–6.8)',
    watering: 'Tez-tez, lekin me’yorida iliq suv bilan (tuproq qurib qolmasin)',
    fertilizer: 'Kalsiy va kaliyga boy o‘g‘itlar meva sifatini oshiradi',
    spacing: 'Qator orasi 60 sm, ko‘chat orasi 30–35 sm',
    harvest: 'Ko‘chat ekilgandan 65–80 kun o‘tib',
    overview:
      "Bulgar qalampiri ko'chatini pomidor kabi chuqur ko'mish mumkin emas — u oldingi tuproq sathidan 1–2 sm dan ortiq chuqurlashtirilmasligi lozim. Birinchi ayri joyda paydo bo'ladigan 'shoh guli'ni uzib tashlash qolgan hosilni 2 barobar oshiradi.",
    preventionSummary: [
      "Tuproqni tez-tez yumshatib turing, lekin ildizga yaqin joyda chuqur chopiq qilmang.",
      "Meva uchining chirishini oldini olish uchun kalsiy nitrat bilan oziqlantiring.",
      "Oq qanot va shiraga qarshi issiqxonaga sariq yopishqoq tuzoqlar o'rnating.",
      "Sug'orishni muntazam qiling — keskin qurg'oqchilikdan keyin ko'p suv berish mevani yoradi.",
    ],
    diseases: [
      {
        name: 'Uchki chirish (Kalsiy yetishmovchiligi)',
        symptoms: "Meva uchida botiq, quruq jigarrang dog' paydo bo'ladi.",
        prevention: "Muntazam sug'orish va bargdan kalsiy bilan oziqlantirish.",
      },
      {
        name: 'Vertitsillez so‘lish',
        symptoms: "Pastki barglar sarg'ayib so'liydi, o'simlik rivojdan to'xtaydi.",
        prevention: "Sog'lom urug' va tuproqni almashlab ekish, zararlangan tupni darhol olib tashlash.",
      },
    ],
  },
  {
    id: 'qulupnay',
    name: "Qulupnay ko'chati",
    category: 'Rezavor',
    shortDescription:
      "Tez hosilga kiruvchi shirin rezavor. O'sish nuqtasi (yurakchasi) tuproq sathida qolishi muvaffaqiyat siri.",
    image: '/src/assets/images/seedling_strawberry_1795607606884.jpg',
    season: 'Erta bahor (Mart – Aprel) yoki kech yoz (Avgust – Sentabr)',
    temperature: '18–24 °C gullash va pishish davrida ideal',
    sunlight: 'Ochiq quyoshli maydon — quyosh qulupnayni shirin qiladi',
    soil: 'Yengil, chirindili, yaxshi drenajlangan tuproq (pH 5.5–6.5)',
    watering: 'Tomchilatib sug‘orish eng yaxshisi; gul va mevaga suv tegmasin',
    fertilizer: 'Gullashdan oldin kompleks o‘g‘it, hosildan keyin kaliy-fosfor',
    spacing: 'Qator orasi 50–60 sm, ko‘chat orasi 25–30 sm',
    harvest: 'Bahorda ekilsa may-iyunda, kuzda ekilsa keyingi bahorda mo‘l hosil',
    overview:
      "Qulupnay ekishda eng muhim qoida — ko'chatning markaziy o'sish kurtakchasi ('yurakchasi') tuproq bilan ko'milib qolmasligi va tashqarida ham osilib qolmasligi kerak. Qora agro-tolali mato yoki somon bilan mulchalash mevalarni toza saqlaydi.",
    preventionSummary: [
      "Tup ostini somon yoki qora plyonka bilan yoping — meva loyga tegib chirimaydi.",
      "Ortiqcha mo'ylovlarni (novdalarni) o'z vaqtida kesib turing, aks holda hosil maydalashadi.",
      "Bahorda quruq va kasallangan eski barglarni tozalab yoqing.",
      "Hosil yig'imidan keyin bir joyda 3–4 yildan ortiq saqlamang, yangilang.",
    ],
    diseases: [
      {
        name: 'Kulrang chirish (Botrytis)',
        symptoms: "Pishgan yoki pishayotgan mevalar yumshab, kulrang mog'or bilan qoplanadi.",
        prevention: "Mulchalash, tomchilatib sug'orish va zichlikka yo'l qo'ymaslik.",
      },
      {
        name: 'Oq dog‘lanish',
        symptoms: "Barglarda qizil hoshiyali mayda oq dog'lar paydo bo'ladi.",
        prevention: "Bahorda mis preparatlari sepish va kasallangan barglarni kesish.",
      },
    ],
  },
];
