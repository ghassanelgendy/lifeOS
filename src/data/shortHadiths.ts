export interface ShortHadith {
  id: string;
  text: string;
  source: string;
  category?: string;
  translation?: string;
}

export const SHORT_HADITHS: ShortHadith[] = [
  {
    id: 'hadith-1',
    text: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى',
    source: 'صحيح البخاري',
    category: 'النية والإخلاص',
    translation: 'Actions are judged by intentions, and every person will get what they intended.',
  },
  {
    id: 'hadith-2',
    text: 'المُسْلِمُ مَنْ سَلِمَ المُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ',
    source: 'صحيح البخاري',
    category: 'الأخلاق والمعاملة',
    translation: 'A Muslim is one from whose tongue and hand other Muslims are safe.',
  },
  {
    id: 'hadith-3',
    text: 'الدِّينُ النَّصِيحَةُ',
    source: 'صحيح مسلم',
    category: 'النصيحة والخير',
    translation: 'Religion is sincerity and good counsel.',
  },
  {
    id: 'hadith-4',
    text: 'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَاليَوْمِ الآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ',
    source: 'صحيح البخاري',
    category: 'حفظ اللسان',
    translation: 'Whoever believes in Allah and the Last Day should speak good or remain silent.',
  },
  {
    id: 'hadith-5',
    text: 'لا تَغْضَبْ، كَرَّرَ مِرَارًا: لا تَغْضَبْ',
    source: 'صحيح البخاري',
    category: 'ضبط النفس',
    translation: 'Do not become angry. He repeated it several times: Do not become angry.',
  },
  {
    id: 'hadith-6',
    text: 'أَحَبُّ الأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ',
    source: 'صحيح البخاري',
    category: 'المداومة على الخير',
    translation: 'The most beloved deeds to Allah are those done consistently, even if they are small.',
  },
  {
    id: 'hadith-7',
    text: 'تَبَسُّمُكَ فِي وَجْهِ أَخِيكَ لَكَ صَدَقَةٌ',
    source: 'جامع الترمذي',
    category: 'البشاشة والصدقة',
    translation: 'Your smile for your brother is a charity.',
  },
  {
    id: 'hadith-8',
    text: 'مَنْ صَلَّى عَلَيَّ صَلَاةً صَلَّى اللَّهُ عَلَيْهِ بِهَا عَشْرًا',
    source: 'صحيح مسلم',
    category: 'الصلاة على النبي',
    translation: 'Whoever sends blessings upon me once, Allah will send blessings upon him ten times.',
  },
  {
    id: 'hadith-9',
    text: 'اتَّقِ اللَّهَ حَيْثُمَا كُنْتَ، وَأَتْبِعِ السَّيِّئَةَ الْحَسَنَةَ تَمْحُهَا، وَخَالِقِ النَّاسَ بِخُلُقٍ حَسَنٍ',
    source: 'جامع الترمذي',
    category: 'التقوى وحسن الخلق',
    translation: 'Fear Allah wherever you are, follow up a bad deed with a good one to erase it, and treat people with good character.',
  },
  {
    id: 'hadith-10',
    text: 'الطُّهُورُ شَطْرُ الإِيمَانِ، وَالْحَمْدُ لِلَّهِ تَمْلأُ الْمِيزَانَ',
    source: 'صحيح مسلم',
    category: 'الطهارة والذكر',
    translation: 'Purity is half of faith, and Al-hamdulillah fills the scales.',
  },
  {
    id: 'hadith-11',
    text: 'الْبِرُّ حُسْنُ الْخُلُقِ',
    source: 'صحيح مسلم',
    category: 'الأخلاق',
    translation: 'Righteousness is good character.',
  },
  {
    id: 'hadith-12',
    text: 'الدَّالُّ عَلَى الْخَيْرِ كَفَاعِلِهِ',
    source: 'جامع الترمذي',
    category: 'الدعوة للخير',
    translation: 'The one who guides to good is like the one who does it.',
  },
  {
    id: 'hadith-13',
    text: 'يَسِّرُوا وَلا تُعَسِّرُوا، وَبَشِّرُوا وَلا تُنَفِّرُوا',
    source: 'صحيح البخاري',
    category: 'التيسير والتبشير',
    translation: 'Make things easy and do not make them difficult; give glad tidings and do not repel people.',
  },
  {
    id: 'hadith-14',
    text: 'كُلُّ مَعْرُوفٍ صَدَقَةٌ',
    source: 'صحيح البخاري',
    category: 'أعمال البر',
    translation: 'Every act of goodness is a charity.',
  },
  {
    id: 'hadith-15',
    text: 'لا يَرْحَمُ اللَّهُ مَنْ لا يَرْحَمُ النَّاسَ',
    source: 'صحيح البخاري',
    category: 'الرحمة',
    translation: 'Allah will not show mercy to one who does not show mercy to people.',
  },
  {
    id: 'hadith-16',
    text: 'احْفَظِ اللَّهَ يَحْفَظْكَ، احْفَظِ اللَّهَ تَجِدْهُ تُجَاهَكَ',
    source: 'جامع الترمذي',
    category: 'معية الله',
    translation: 'Be mindful of Allah and He will protect you; be mindful of Allah and you will find Him in front of you.',
  },
  {
    id: 'hadith-17',
    text: 'خَيْرُكُمْ مَنْ تَعَلَّمَ القُرْآنَ وَعَلَّمَهُ',
    source: 'صحيح البخاري',
    category: 'فضائل القرآن',
    translation: 'The best among you are those who learn the Quran and teach it.',
  },
  {
    id: 'hadith-18',
    text: 'مَنْ يُرِدِ اللَّهُ بِهِ خَيْرًا يُفَقِّهْهُ فِي الدِّينِ',
    source: 'صحيح البخاري',
    category: 'طلب العلم',
    translation: 'Whomever Allah desires good for, He grants him understanding of the religion.',
  },
  {
    id: 'hadith-19',
    text: 'مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الجَنَّةِ',
    source: 'صحيح مسلم',
    category: 'العلم والجنة',
    translation: 'Whoever treads a path seeking knowledge, Allah makes easy for him a path to Paradise.',
  },
  {
    id: 'hadith-20',
    text: 'الْكَلِمَةُ الطَّيِّبَةُ صَدَقَةٌ',
    source: 'صحيح البخاري',
    category: 'الطيب من القول',
    translation: 'A good word is a charity.',
  },
  {
    id: 'hadith-21',
    text: 'إِنَّ اللَّهَ طَيِّبٌ لا يَقْبَلُ إِلاَّ طَيِّبًا',
    source: 'صحيح مسلم',
    category: 'الإخلاص والطهارة',
    translation: 'Allah is Pure and accepts only that which is pure.',
  },
  {
    id: 'hadith-22',
    text: 'عَجَبًا لأَمْرِ الْمُؤْمِنِ إِنَّ أَمْرَهُ كُلَّهُ خَيْرٌ',
    source: 'صحيح مسلم',
    category: 'الصبر والشكر',
    translation: 'How wonderful is the affair of the believer, for his affair is all good.',
  },
  {
    id: 'hadith-23',
    text: 'المُؤْمِنُ القَوِيُّ خَيْرٌ وَأَحَبُّ إِلَى اللَّهِ مِنَ المُؤْمِنِ الضَّعِيفِ، وَفِي كُلٍّ خَيْرٌ',
    source: 'صحيح مسلم',
    category: 'القوة والهمة',
    translation: 'The strong believer is better and more beloved to Allah than the weak believer, though there is good in both.',
  },
  {
    id: 'hadith-24',
    text: 'ارْحَمُوا مَنْ فِي الأَرْضِ يَرْحَمْكُمْ مَنْ فِي السَّمَاءِ',
    source: 'جامع الترمذي',
    category: 'الرحمة والتكافل',
    translation: 'Show mercy to those on earth, and the One in heaven will show mercy to you.',
  },
  {
    id: 'hadith-25',
    text: 'مَنْ كَانَ فِي حَاجَةِ أَخِيهِ كَانَ اللَّهُ فِي حَاجَتِهِ',
    source: 'صحيح البخاري',
    category: 'قضاء الحوائج',
    translation: 'Whoever fulfills the need of his brother, Allah will fulfill his need.',
  }
];

export function getDailyHadith(dateStr?: string): ShortHadith {
  const targetDate = dateStr || new Date().toISOString().split('T')[0];
  let hash = 0;
  for (let i = 0; i < targetDate.length; i++) {
    hash = (hash << 5) - hash + targetDate.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % SHORT_HADITHS.length;
  return SHORT_HADITHS[index];
}

export function getRandomHadith(currentIndex?: number): { hadith: ShortHadith; index: number } {
  let randomIndex = Math.floor(Math.random() * SHORT_HADITHS.length);
  if (currentIndex !== undefined && SHORT_HADITHS.length > 1) {
    while (randomIndex === currentIndex) {
      randomIndex = Math.floor(Math.random() * SHORT_HADITHS.length);
    }
  }
  return { hadith: SHORT_HADITHS[randomIndex], index: randomIndex };
}
