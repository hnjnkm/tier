import type { Artist, Gender, Genre } from '../types';

// Korean performing artists across generations. Idol members and subunits are
// represented by their parent groups in the discovery collection.
const additions: Artist[] = [];
function add(genres: Genre[], gender: Gender, kind: Artist['kind'], rows: string) {
  for (const line of rows.trim().split('\n')) {
    const [name, englishName, wikiTitle, aliases] = line.trim().split('|');
    additions.push({ id: `kr-${englishName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')}`, name, englishName, wikiTitle: wikiTitle || undefined, aliases: aliases ? aliases.split(',') : [], genres, gender, kind, source: 'catalog' });
  }
}

add(['ballad'], 'male', 'solo', `
이수|ISU|Lee Soo (singer)|김나박이,김나박,엠씨더맥스 이수
김연우|Kim Yeon Woo|Kim Yeon-woo
김조한|Kim Johan|Kim Jo-han
임재범|Yim Jae Beom|Yim Jae-beom
이승환|Lee Seung Hwan|Lee Seung-hwan
신승훈|Shin Seung Hun|Shin Seung-hun
조성모|Jo Sung Mo|Jo Sung-mo
변진섭|Byun Jin Sub|Byun Jin-sub
김민종|Kim Min Jong|Kim Min-jong
김정민|Kim Jung Min|Kim Jung-min (singer)
임창정|Lim Chang Jung|Im Chang-jung
김장훈|Kim Jang Hoon|Kim Jang-hoon
박상민|Park Sang Min|Park Sang-min (singer)
김현성|Kim Hyun Sung|Kim Hyun-sung
김원준|Kim Won Jun|Kim Won-jun
이지훈|Lee Ji Hoon|Lee Ji-hoon (entertainer)
이정|Lee Jung|Lee Jung
하동균|Ha Dong Qn|Ha Dong-kyun|Ha Dong Kyun
김광진|Kim Kwang Jin|Kim Kwang-jin (musician)
김형중|Kim Hyung Joong|Kim Hyung-jung
허각|Huh Gak|Huh Gak
허공|Huh Gong|Huh Gong
정승환|Jung Seung Hwan|Jung Seung-hwan (singer)
신용재|Shin Yong Jae|Shin Yong-jae
김원주|Kim Won Joo|Kim Won-joo
박지헌|Park Ji Heon|Park Ji-heon
김경록|Kim Kyung Rok|Kim Kyung-rok
최현준|Choi Hyun Joon|Choi Hyun-jun
김진호|Kim Jin Ho|Kim Jin-ho
이석훈|Lee Seok Hoon|Lee Seok-hoon
김용준|Kim Yong Jun|Kim Yong-jun (singer)
민경훈|Min Kyung Hoon|Min Kyung-hoon
정동하|Jung Dong Ha|Jung Dong-ha
김필|Kim Feel|Kim Feel
박원|Park Won|Park Won
양다일|Yang Da Il|Yang Da-il
나윤권|Na Yoon Kwon|Na Yoon-kwon
이기찬|Lee Ki Chan|Lee Ki-chan
테이|Tei|Tei
팀|Tim|Tim (singer)|팀 황영민
이현|Lee Hyun|Lee Hyun
한동근|Han Dong Geun|Han Dong-geun
임한별|Onestar|Lim Han-byul|Lim Han Byul
마크툽|MAKTUB|Maktub (singer)
황치열|Hwang Chi Yeul|Hwang Chi-yeul
홍대광|Hong Dae Kwang|Hong Dae-kwang
곽진언|Kwak Jin Eon|Kwak Jin-eon
장범준|Jang Beom June|Jang Beom-jun
정준일|Jung Joon Il|Jung Joon-il
윤건|Yoon Gun|Yoon Gun
정엽|Jung Yup|Jung Yup
김민석|Kim Min Seok||멜로망스 김민석
한경일|Han Kyung Il|Han Kyung-il
모세|Mose|Mose (singer)
K2 김성면|K2 Kim Sung Myun||김성면,K2
더원|The One|The One (singer)|정순원
강균성|Kang Kyun Sung|Kang Kyun-sung|강균성
배기성|Bae Ki Sung|Bae Ki-sung
이정봉|Lee Jung Bong
고유진|Ko Yu Jin|Ko Yu-jin
김종서|Kim Jong Seo|Kim Jong-seo
조관우|Jo Kwan Woo|Jo Kwan-woo
조규찬|Cho Kyu Chan|Cho Kyu-chan
이현우|Lee Hyun Woo|Lee Hyun-woo (singer)
전우성|Jeon Woo Sung
정세운|Jeong Se Woon|Jeong Se-woon
이솔로몬|Lee Solomon|Lee Solomon
박창근|Park Chang Geun|Park Chang-geun
박장현|Park Jang Hyun
손진욱|Son Jin Wook
이병찬|Lee Byung Chan
김수철|Kim Soo Chul|Kim Soo-chul
김범룡|Kim Bum Ryong|Kim Bum-ryong
김승덕|Kim Seung Deok
김민우|Kim Min Woo|Kim Min-woo (singer)
`);

add(['ballad'], 'female', 'solo', `
거미|GUMMY|Gummy (singer)
린|LYn|Lyn (singer)
나비|Navi|Navi (singer)
벤|BEN|Ben (singer)
양파|Yangpa|Yangpa
박정현|Lena Park|Lena Park|박정현,Lena
박화요비|Hwayobi|Hwayobi|화요비
소향|Sohyang|Sohyang
이영현|Lee Young Hyun|Lee Young-hyun
이수영|Lee Soo Young|Lee Soo-young
정인|Jung In|Jung-in
박혜원|HYNN|Hynn|HYNN,흰
케이시|Kassy|Kassy
펀치|Punch|Punch (singer)
경서|KyoungSeo|KyoungSeo
서영은|Seo Young Eun|Seo Young-eun (singer)
장혜진|Jang Hye Jin|Jang Hye-jin (singer)
진주|Jinju|Jinju
김나영|Kim Na Young|Kim Na-young (singer)
박보람|Park Bo Ram|Park Bo-ram
이예준|Lee Ye Joon|Lee Ye-jun (singer)
송하예|Song Ha Yea|Song Ha-ye
지아|Zia|Zia (singer)
박기영|Park Ki Young|Park Ki-young
적우|Red Rain|Red Rain|적우
란|RAN|Ran (singer)
디아|DIA (solo)|Dia (singer)|디아,Dia
리사|Lisa (Korean vocalist)||정희선
페이지|Page (Korean vocalist)||이가은
안다|ANDA|Anda (singer)
신예영|Shin Ye Young
차수경|Cha Soo Kyung|Cha Soo-kyung
이보람|Lee Bo Ram|Lee Bo-ram
박선주|Park Sun Joo|Park Sun-joo
권진원|Kwon Jin Won|Kwon Jin-won
정수라|Jung Soo Ra|Jung Soo-ra
정미조|Jung Mi Jo|Jung Mi-jo
유미|Youme|Youme (singer)
숙희|Suki|Suki (singer)
리디아|Lydia (Korean singer)
한소아|Han Soa
제이세라|J-Cera|J-Cera
우은미|Woo Eun Mi
손승연|Son Seung Yeon|Son Seung-yeon
보라미유|Boramiyu
노디시카|Nody Cika
송지은|Song Ji Eun|Song Ji-eun
`);

add(['ballad', 'rnb'], 'male', 'group', `
포맨|4MEN|4Men|4맨
브라운 아이즈|Brown Eyes|Brown Eyes (band)
솔리드|Solid|Solid (band)
노을|Noel|Noel (band)
V.O.S|V.O.S|V.O.S|브이오에스
투빅|2BiC|2BiC|투빅
길구봉구|GB9|Gilgu Bonggu|Gilgu Bonggu,길구 봉구
바이브|VIBE|Vibe (band)
플라이 투 더 스카이|Fly to the Sky|Fly to the Sky
캔|CAN|Can (South Korean band)
더 크로스|The Cross|The Cross (South Korean band)
먼데이키즈|Monday Kiz|Monday Kiz|먼데이 키즈,이진성
스윗소로우|Sweet Sorrow|Sweet Sorrow
소울스타|Soulstar|Soulstar
하이포|HIGH4|High4
`);

add(['ballad'], 'female', 'group', `
빅마마|Big Mama|Big Mama (group)
씨야|SeeYa|SeeYa
가비엔제이|Gavy NJ|Gavy NJ
경서예지|KyoungSeo Yeji
옥상달빛|OKDAL|Okdal
`);

add(['hiphop'], 'male', 'solo', `
비와이|BewhY|BewhY
도끼|Dok2|Dok2
더콰이엇|The Quiett|The Quiett
팔로알토|Paloalto|Paloalto (rapper)
로꼬|Loco|Loco (rapper)
사이먼 도미닉|Simon Dominic|Simon Dominic|쌈디,정기석
스윙스|Swings|Swings (rapper)
저스디스|JUSTHIS|Justhis
피에이치원|pH-1|PH-1
우원재|Woo|Woo Won-jae|우원재,Woo Won Jae
그레이|GRAY|Gray (singer)
기리보이|GIRIBOY|Giriboy
릴보이|lIlBOI|Lil Boi
루피|Loopy|Loopy (rapper)
나플라|nafla|Nafla
오왼|Owen|Owen (rapper)|Owen Ovadoz
블루|BLOO|Bloo (rapper)
식케이|Sik-K|Sik-K
빅나티|BIG Naughty|Big Naughty|서동현,빅 나티
한요한|HAN YO HAN|Han Yo-han
애쉬 아일랜드|ASH ISLAND|Ash Island|애쉬아일랜드
릴러말즈|Leellamarz|Leellamarz
김하온|HAON|Haon
양홍원|Young B|Yang Hong-won|Young B
씨잼|C JAMM|C Jamm
한해|HANHAE|Hanhae
산이|San E|San E
MC몽|MC MONG|MC Mong|엠씨몽
매드클라운|Mad Clown|Mad Clown
딥플로우|Deepflow|Deepflow
던밀스|Don Mills|Don Mills (rapper)
넉살|Nucksal|Nucksal
이센스|E SENS|E Sens
개리|Gary|Gary (rapper)
길|Gil|Gil (musician)
버벌진트|Verbal Jint|Verbal Jint
주석|Joosuc|Joosuc
피타입|P-Type|P-Type
비즈니스|BIZNIZ|Bizniz
슬리피|Sleepy|Sleepy (rapper)
디액션|D.Action|D.Action
타이거JK|Tiger JK|Tiger JK
MC스나이퍼|MC SNIPER|MC Sniper|엠씨스나이퍼
아웃사이더|Outsider|Outsider (rapper)
데프콘|Defconn|Defconn
허클베리피|Huckleberry P|Huckleberry P
제리케이|Jerry.K|Jerry.K
오르내림|OLNL|OLNL
김심야|Kim Ximya|Kim Ximya
기린|KIRIN|Kirin (musician)
뱃사공|BASSAGONG
던말릭|Don Malik|Don Malik
허성현|Huh|Huh (rapper)
쿤디판다|Khundi Panda|Khundi Panda
맥대디|Mckdaddy
칠린호미|Chillin Homie
디보|Dbo|Dbo (rapper)
수퍼비|SUPERBEE|Superbee
언에듀케이티드 키드|UNEDUCATED KID|Uneducated Kid|언에듀
노엘|NOEL (rapper)|Noel (rapper)|장용준
블랙넛|Black Nut|Black Nut
테이크원|TAKEONE|Takeone (rapper)|김태균
바이스벌사|viceversa|Viceversa (rapper)
제네 더 질라|ZENE THE ZILLA|Zene the Zilla
쿠기|Coogie|Coogie
래원|Layone|Layone
블라세|Blase|Blase (rapper)
노윤하|Roh Yun Ha|Roh Yun-ha
빅원|BIGONE|Bigone (rapper)
김효은|Keem Hyo Eun|Kim Hyo-eun (rapper)
디젤|dsel
페노메코|PENOMECO|Penomeco
베이식|Basick|Basick
지투|G2|G2 (rapper)
레디|Reddy|Reddy
오케이션|Okasian|Okasian
아이언|IRON|Iron (rapper)
빈스|Vince|Vince (singer)
차메인|CHAMANE|Chamane
트레이드엘|TRADE L|Trade L
아우릴고트|OUREALGOAT
브라운티거|Brown Tigger
`);

add(['hiphop', 'rnb'], 'female', 'solo', `
윤미래|Yoon Mi Rae|Yoon Mi-rae|Tasha,T,타샤
재키와이|Jvcki Wai|Jvcki Wai
미란이|Mirani|Mirani
카모|CAMO|Camo (musician)
릴체리|Lil Cherry|Lil Cherry
퀸와사비|Queen WA$ABII|Queen Wa$abii
치타|Cheetah|Cheetah (rapper)
키썸|Kisum|Kisum
애쉬비|ASH-B|Ash-B
예지|YEZI|Yezi
브린|Bryn|Bryn (rapper)
타이미|Tymee|Tymee
나다|NADA|Nada (rapper)
유나킴|Euna Kim|Euna Kim
`);

add(['hiphop'], 'male', 'group', `
리쌍|Leessang|Leessang
배치기|Baechigi|Baechigi
드렁큰타이거|Drunken Tiger|Drunken Tiger
슈프림팀|Supreme Team|Supreme Team (group)
긱스|Geeks|Geeks (musical duo)
언터쳐블|Untouchable|Untouchable (band)
호미들|Homies|Homies (group)
XXX|XXX|XXX (duo)
소울다이브|Soul Dive|Soul Dive
마이티마우스|Mighty Mouth|Mighty Mouth (band)
듀스|DEUX|Deux (band)
지누션|JINUSEAN|Jinusean
클론|CLON|Clon (duo)
터보|Turbo|Turbo (South Korean band)
`);
add(['hiphop', 'rnb'], 'mixed', 'group', `
MFBTY|MFBTY|MFBTY
`);

add(['rnb'], 'male', 'solo', `
정기고|Junggigo|Junggigo
자이언티|Zion.T|Zion.T
지소울|GSoul|GSoul|G.Soul,G Soul,골든,Golden
이든|EDEN|Eden (musician)
베이빌론|Babylon|Babylon (singer)
콜드|Colde|Colde
엘로|ELO|Elo (singer)
죠지|george|George (South Korean singer)
김뮤지엄|KIMMUSEUM|Kimmuseum
오션프롬더블루|oceanfromtheblue
정진우|Jung Jin Woo|Jung Jin-woo (singer)
지바노프|jeebanoff|Jeebanoff
서사무엘|Samuel Seo|Samuel Seo
준|JUNE|June (singer)
범키|BUMKEY|Bumkey
라디|Ra.D|Ra.D
존박|John Park|John Park
에릭남|Eric Nam|Eric Nam
버나드박|Bernard Park|Bernard Park
케빈오|Kevin Oh|Kevin Oh
에디킴|Eddy Kim|Eddy Kim
빈센트블루|Vincent Blue|Vincent Blue
진보|JINBO|Jinbo
다운|Dvwn|Dvwn
DPR LIVE|DPR LIVE|DPR Live|홍다빈,DABIN
디피알 이안|DPR IAN|DPR Ian|DPR IAN,크리스천 유
샘옥|Sam Ock|Sam Ock
니브|NIve|Nive (musician)
차우|Chawoo
주영|JOOYOUNG|Jooyoung
김현철|Kim Hyun Chul|Kim Hyun-chul
소울맨|Soulman
디기리|Digiri||디기리
골드부다|GOLDBUUDA
`);

add(['rnb'], 'female', 'solo', `
쏠|SOLE|Sole (singer)
수란|SURAN|Suran
후디|Hoody|Hoody (singer)
서리|Seori|Seori
소금|sogumm|Sogumm
쎄이|SAAY|Saay
드비타|DeVita|DeVita
유라|youra|Youra
유성은|U Sung Eun|U Sung-eun
제이|J.ae|J.ae|J,정재영
민서|MINSEO|Minseo
문수진|Moon Sujin|Moon Su-jin
`);
add(['rnb', 'indie'], 'male', 'group', `
오프온오프|offonoff|Offonoff
마틴스미스|Martin Smith|Martin Smith (band)
`);

add(['rock'], 'male', 'solo', `
김경호|Kim Kyung Ho|Kim Kyung-ho
박완규|Park Wan Kyu|Park Wan-kyu
하현우|Ha Hyun Woo|Ha Hyun-woo
김바다|Kim Bada|Kim Bada
이승열|Yi Sung Yol|Yi Sung-yol
육중완|Yook Joong Wan||육중완
전인권|Jeon In Kwon|Jeon In-kwon
신중현|Shin Joong Hyun|Shin Jung-hyeon
`);
add(['rock'], 'male', 'group', `
엠씨더맥스|M.C THE MAX|M.C the Max|M.C the Max,MC THE MAX
버즈|BUZZ|Buzz (South Korean band)
부활|BOOHWAL|Boohwal
백두산|BAEKDOOSAN|Baekdoosan
시나위|SINAWE|Sinawe
송골매|Songolmae|Songgolmae
산울림|Sanullim|Sanulrim
들국화|Deulgukhwa|Deulgukhwa
N.EX.T|N.EX.T|N.EX.T|넥스트
패닉|Panic|Panic (band)
카니발|Carnival|Carnival (band)
봄여름가을겨울|Spring Summer Fall Winter|Spring Summer Autumn Winter
빛과소금|Light and Salt|Light & Salt
블랙홀|Black Hole|Black Hole (South Korean band)
블랙신드롬|Black Syndrome
크래쉬|CRASH|Crash (South Korean band)
디아블로|Diablo (Korean band)
닥터코어911|Dr. Core 911
노브레인|No Brain|No Brain
크라잉넛|Crying Nut|Crying Nut
피아|PIA|Pia (band)
몽니|Monni|Monni
쏜애플|THORNAPPLE|Thornapple (band)
국카스텐|Guckkasten|Guckkasten
소란|Soran|Soran (band)
데이브레이크|DAYBREAK|Daybreak (band)
페퍼톤스|Peppertones|Peppertones
딕펑스|DickPunks|DickPunks
엔플라잉|N.Flying|N.Flying
더로즈|The Rose|The Rose (band)
원위|ONEWE|Onewe
설|SURL|Surl (band)
웨터|WETTER|Wetter (band)
언니네이발관|Sister's Barbershop|Sister's Barbershop
뜨거운감자|Hot Potato|Hot Potato (band)
델리스파이스|Deli Spice|Deli Spice
트랜스픽션|Transfixion|Transfixion
레이지본|Lazybone|Lazybone (band)
스키조|Schizo|Schizo (band)
장미여관|Rose Motel|Rose Motel
육중완밴드|Yook Joong Wan Band
로맨틱펀치|Romantic Punch|Romantic Punch
브로큰발렌타인|Broken Valentine|Broken Valentine
네미시스|Nemesis|Nemesis (South Korean band)
서태지와아이들|Seo Taiji and Boys|Seo Taiji and Boys
옥슨80|Oxen 80
이치현과벗님들|Lee Chi Hyun and Friends
작은거인|Little Giant (Korean band)
노리플라이|no reply|No Reply (band)
메이트|MATE|Mate (band)
넬|NELL|Nell (band)
호피폴라|Hoppipolla|Hoppipolla (band)
불독맨션|Bulldog Mansion|Bulldog Mansion
갤럭시 익스프레스|Galaxy Express|Galaxy Express
`);
add(['rock'], 'female', 'group', `
롤링쿼츠|Rolling Quartz|Rolling Quartz
한스밴드|Hans Band|Hans Band
`);
add(['rock', 'indie'], 'mixed', 'group', `
터치드|TOUCHED|Touched (band)
체리필터|Cherry Filter|Cherry Filter
새소년|SE SO NEON|Se So Neon
더 발룬티어스|The Volunteers|The Volunteers (band)
코토바|cotoba|Cotoba
3호선 버터플라이|3rd Line Butterfly|3rd Line Butterfly
럼블피쉬|Rumble Fish|Rumble Fish (band)
`);

add(['indie', 'folk'], 'male', 'solo', `
카더가든|Car the garden|Car, the Garden|메이슨 더 소울,Mayson the Soul
검정치마|The Black Skirts|The Black Skirts|조휴일
짙은|Zitten|Zitten
커피소년|Coffee Boy|Coffee Boy
오왠|O.WHEN|O.When
빌리어코스티|Bily Acoustie
알레프|ALEPH|Aleph (musician)
오존|O3ohn|O3ohn
최낙타|Choi Nakta
이지형|Lee Ji Hyoung|Lee Ji-hyoung
루시드폴|Lucid Fall|Lucid Fall
하림|Hareem|Hareem
구원찬|Ku One Chan|Ku One-chan
구름|Cloud|Cloud (musician)|고형석
김제형|Kim Je Hyeong
권나무|Kwon Tree
정차식|Jeong Cha Sik|Jeong Cha-sik
정재원|Jung Jae Won
임헌일|Im Heon Il|Im Heon-il
권순관|Kwon Soon Kwan|Kwon Soon-kwan
하현상|Ha Hyun Sang|Ha Hyun-sang
홍이삭|Isaac Hong|Hong Isaac
소수빈|So Soo Bin|So Soo-bin
나상현|Na Sang Hyun
신해경|Shin Hae Gyeong|Shin Hae-gyeong
이영훈|Lee Young Hoon (indie)|Lee Young-hoon (singer)
도후|Dohu (singer)
오시영|Oh Si Young
지범|J.Burn
범진|BUMJIN|Bumjin
스무살|20 Years of Age|20 Years of Age (singer)|스무 살
`);

add(['indie', 'folk'], 'female', 'solo', `
선우정아|sunwoojunga|Sunwoo Jung-a
우효|OOHYO|Oohyo
스텔라장|Stella Jang|Stella Jang
프롬|Fromm|Fromm (singer)
심규선|Lucia|Lucia (singer)|Lucia,루시아
한희정|Han Hee Jung|Han Hee-jung
김사월|Kim Sawol|Kim Sa-wol
허회경|Heo Hoy Kyung|Heo Hoy-kyung
최유리|Choi Yu Ree|Choi Yu-ri
백아|Baek A|Baek A
김뜻돌|Meaningful Stone|Meaningful Stone
다린|Darin (Korean singer)
윤지영|Yoon Ji Young|Yoon Ji-young
김수영|Kim Soo Young (singer)
우예린|Woo Ye Rin|Woo Ye-rin
안예은|Ahn Ye Eun|Ahn Ye-eun
신지훈|Shin Ji Hoon|Shin Ji-hoon
김예림|Lim Kim|Lim Kim|LIM KIM
요조|Yozoh|Yozoh
강아솔|Kang Asol
정우|Jung Woo (female singer)||정우
정밀아|Jeongmilla|Jeongmilla
오지은|Oh Ji Eun|Oh Ji-eun (musician)
이랑|Lang Lee|Lee Lang
황소윤|So!YoON!|So!YoON!|황소윤
조원선|Jo Won Sun|Jo Won-sun
장필순|Jang Pil Soon|Jang Pil-soon
모트|Motte|Motte (singer)
달수빈|DALsooobin|Dalsooobin
예빛|Yebit
다나|DANA (soloist)|Dana (singer)
치즈|CHEEZE|Cheeze (band)|달총,Dalchong
`);

add(['indie', 'rock'], 'male', 'group', `
너드커넥션|Nerd Connection|Nerd Connection
나상현씨밴드|Band Nah|Band Nah
웨이브투어스|wave to earth|Wave to Earth|웨이브 투 어스
오이스터|Oyster (Korean band)
9와 숫자들|9 and the Numbers|9 and the Numbers
재주소년|Jaejoo Boys|Jaejoo Boys
안녕바다|Bye Bye Sea|Bye Bye Sea
몽구스|Mongoose|Mongoose (band)
눈뜨고코베인|Nunco|Nunco|눈뜨고 코베인
칵스|THE KOXX|The Koxx
일로와이로|IloYlo
에브리싱글데이|Every Single Day|Every Single Day (band)
원모어찬스|One More Chance|One More Chance (band)
`);
add(['indie', 'folk'], 'female', 'group', `
스웨덴세탁소|Sweden Laundry|Sweden Laundry
루싸이트토끼|Lucite Tokki|Lucite Tokki
바버렛츠|The Barberettes|The Barberettes
`);
add(['indie', 'folk'], 'mixed', 'group', `
어쿠스틱콜라보|Acoustic Collabo|Acoustic Collabo
가을방학|Autumn Vacation|Autumn Vacation
신인류|Shin In Ryu
`);

add(['dance'], 'male', 'group', `
엔시티|NCT|NCT (group)|엔시티127,엔시티 드림,NCT DREAM,NCT 127,NCT WISH,WayV,웨이션브이
god|god|G.o.d.|지오디,김태우,손호영,데니안,윤계상,박준형
H.O.T.|H.O.T.|H.O.T. (band)|에이치오티,문희준,장우혁,토니안,강타,이재원
젝스키스|SECHSKIES|Sechs Kies|은지원,이재진,김재덕,장수원
신화|SHINHWA|Shinhwa|에릭,신혜성,이민우,김동완,전진,앤디
SS501|SS501|SS501|더블에스오공일
워너원|Wanna One|Wanna One|강다니엘,박지훈,옹성우,하성운,황민현
X1|X1|X1 (group)
제로베이스원|ZEROBASEONE|Zerobaseone|ZB1,제베원
블락비|Block B|Block B
빅스|VIXX|VIXX
뉴이스트|NU'EST|NU'EST|뉴이스트
B.A.P|B.A.P|B.A.P (South Korean band)|비에이피
엠블랙|MBLAQ|MBLAQ
틴탑|TEEN TOP|Teen Top
보이프렌드|BOYFRIEND|Boyfriend (band)
유키스|U-KISS|U-KISS
제국의아이들|ZE:A|ZE:A|제국의 아이들
투에이엠|2AM|2AM (band)|조권,창민,임슬옹,정진운
펜타곤|PENTAGON|Pentagon (South Korean band)
SF9|SF9|SF9
아스트로|ASTRO|Astro (South Korean band)|차은우
골든차일드|Golden Child|Golden Child (band)
온앤오프|ONF|ONF (band)
베리베리|VERIVERY|Verivery
원어스|ONEUS|Oneus
템페스트|TEMPEST|Tempest (band)
이펙스|EPEX|Epex
크래비티|CRAVITY|Cravity
에이비식스|AB6IX|AB6IX
씨아이엑스|CIX|CIX (group)
드리핀|DRIPPIN|Drippin
루네이트|LUN8|Lun8
에잇턴|8TURN|8Turn
휘브|WHIB|Whib
더윈드|The Wind|The Wind (South Korean band)
이븐|EVNNE|Evnne
앰퍼샌드원|AMPERS&ONE|Ampers&One
플레이브|PLAVE|Plave
넥스지|NEXZ|Nexz
킥플립|KickFlip|KickFlip (group)
클로즈유어아이즈|CLOSE YOUR EYES|Close Your Eyes (group)
아홉|AHOF|Ahof
배너|VANNER|Vanner
BAE173|BAE173|BAE173|비에이이일칠삼,비에이일칠삼
다크비|DKB|DKB
엠씨엔디|MCND|MCND
위아이|WEi|WEi
업텐션|UP10TION|Up10tion
소년공화국|Boys Republic|Boys Republic
빅플로|BIGFLO|Bigflo
크나큰|KNK|KNK
`);
add(['dance'], 'female', 'group', `
핑클|Fin.K.L|Fin.K.L|성유리,이진,옥주현,이효리
S.E.S.|S.E.S.|S.E.S. (group)|바다,유진,슈
베이비복스|Baby V.O.X|Baby Vox
디바|DIVA|Diva (South Korean group)
쥬얼리|Jewelry|Jewelry (group)|박정아,서인영
클레오|Cleo|Cleo (group)
티티마|T.T.Ma|T.T.Ma
투야|To-Ya|To-Ya
샤크라|Chakra|Chakra (group)
파파야|Papaya|Papaya (band)
미쓰에이|miss A|Miss A|미스에이,수지,배수지
원더걸스|Wonder Girls|Wonder Girls|선미,예은,핫펠트,유빈,안소희
에프엑스|f(x)|F(x) (group)|fx,루나,크리스탈,엠버
티아라|T-ARA|T-ara
애프터스쿨|After School|After School (band)|오렌지캬라멜,나나,리지,레이나
걸스데이|Girl's Day|Girl's Day|혜리,소진,민아,유라
나인뮤지스|9MUSES|Nine Muses (group)
레인보우|RAINBOW|Rainbow (girl group)
달샤벳|Dal Shabet|Dal Shabet|달수빈
헬로비너스|HELLOVENUS|Hello Venus
이엑스아이디|EXID|EXID|하니,솔지
크레용팝|Crayon Pop|Crayon Pop
AOA|AOA|AOA (group)
에이프릴|APRIL|April (girl group)
위키미키|Weki Meki|Weki Meki
프리스틴|PRISTIN|Pristin
구구단|gugudan|Gugudan
다이아|DIA|DIA (group)
아이오아이|I.O.I|I.O.I|전소미,청하,김세정,김도연,최유정,정채연
아이즈원|IZ*ONE|Iz*One|조유리,권은비,최예나,장원영,안유진,김채원,사쿠라
씨엘씨|CLC|CLC (group)
우아|woo!ah!|Wooah
위클리|Weeekly|Weeekly
퍼플키스|PURPLE KISS|Purple Kiss
드림캐쳐|Dreamcatcher|Dreamcatcher (group)
하이키|H1-KEY|H1-Key
빌리|Billlie|Billlie
리센느|RESCENE|Rescene
네이처|NATURE|Nature (group)
메이딘|MADEIN|Madein
캔디샵|Candy Shop|Candy Shop (group)
세이마이네임|SAY MY NAME|Say My Name (group)
유니스|UNIS|Unis (group)
미야오|MEOVV|Meovv
하츠투하츠|Hearts2Hearts|Hearts2Hearts
키키|KiiiKiii|KiiiKiii
이달의소녀|LOONA|Loona|이달의 소녀,츄,이브,희진,하슬,김립,진솔,최리
우주소녀|WJSN|WJSN|Cosmic Girls
시크릿|SECRET|Secret (South Korean group)|송지은,전효성,한선화
`);
add(['dance', 'hiphop'], 'mixed', 'group', `
올데이프로젝트|ALLDAY PROJECT|Allday Project
카드|KARD|Kard (group)
룰라|Roo'ra|Roo'ra
샵|S#arp|S#arp
거북이|Turtles|Turtles (South Korean band)
유피|UP|UP (band)
`);
add(['dance'], 'male', 'group', `
노이즈|Noise|Noise (band)
언타이틀|Untitle|Untitle
R.ef|R.ef|R.ef
`);

add(['trot'], 'male', 'solo', `
장민호|Jang Min Ho|Jang Minho
김호중|Kim Ho Joong|Kim Ho-joong
김희재|Kim Hee Jae|Kim Hee-jae
진해성|Jin Hae Seong|Jin Hae-seong
박서진|Park Seo Jin|Park Seo-jin
신유|Shin Yu|Shin Yu
손태진|Son Tae Jin|Son Tae-jin
박지현|Park Ji Hyeon (trot singer)|Park Ji-hyeon (singer)
최수호|Choi Su Ho
안성훈|An Sung Hoon|An Sung-hoon
나태주|Na Tae Joo|Na Tae-joo
진성|Jin Sung|Jin Sung
태진아|Tae Jin Ah|Tae Jin-ah
송대관|Song Dae Kwan|Song Dae-kwan
설운도|Seol Woon Do|Seol Woon-do
박현빈|Park Hyun Bin|Park Hyun-bin
남진|Nam Jin|Nam Jin
나훈아|Na Hoon A|Na Hoon-a
현철|Hyun Chul|Hyun Chul
강진|Kang Jin|Kang Jin (singer)
박구윤|Park Gu Yun|Park Gu-yun
재하|Jaeha (trot singer)
김수찬|Kim Soo Chan|Kim Soo-chan
최우진|Choi Woo Jin
영기|Young Ki|Young Ki
조항조|Jo Hang Jo|Jo Hang-jo
박상철|Park Sang Cheol|Park Sang-chul
박군|Park Koon|Park Goon
민수현|Min Soo Hyun|Min Soo-hyun
에녹|Enoch|Enoch (actor)
신승태|Shin Seung Tae|Shin Seung-tae
추혁진|Chu Hyuk Jin
김중연|Kim Jung Yeon|Kim Jung-yeon (singer)
최대성|Choi Dae Sung
진욱|Jin Wook (trot singer)
양지원|Yang Ji Won (trot singer)|Yang Ji-won (male singer)
황민우|Hwang Min Woo|Hwang Min-woo
공훈|Gong Hoon|Gong Hoon
이찬성|Lee Chan Sung
박현호|Park Hyun Ho|Park Hyun-ho
남인수|Nam In Soo|Nam In-su
현인|Hyun In|Hyun In
고복수|Go Bok Soo|Go Bok-su
백년설|Baek Nyeon Seol|Baek Nyeon-seol
배호|Bae Ho|Bae Ho
최희준|Choi Hee Joon|Choi Hee-jun
박일남|Park Il Nam|Park Il-nam
김상배|Kim Sang Bae
`);
add(['trot'], 'female', 'solo', `
김연자|Kim Yon Ja|Kim Yon-ja
주현미|Joo Hyun Mi|Joo Hyun-mi
심수봉|Sim Soo Bong|Sim Soo-bong
현숙|Hyun Sook|Hyun Sook
김용임|Kim Yong Im|Kim Yong-im
최진희|Choi Jin Hee|Choi Jin-hee
문희옥|Moon Hee Ok|Moon Hee-ok
금잔디|Kum Jan Di|Kum Jan-di
홍자|Hong Ja|Hong Ja
양지은|Yang Ji Eun|Yang Ji-eun
전유진|Jeon Yu Jin|Jeon Yu-jin
김다현|Kim Da Hyun (trot singer)|Kim Da-hyun (singer)
김태연|Kim Tae Yeon (trot singer)|Kim Tae-yeon (singer)
은가은|Eun Ga Eun|Eun Ga-eun
김소유|Kim So Yu|Kim So-yu
윤수현|Yoon Soo Hyun|Yoon Soo-hyun (singer)
요요미|YOYOMI|Yoyomi
정다경|Jung Da Kyung|Jung Da-kyung
강혜연|Kang Hye Yeon|Kang Hye-yeon
두리|DooRi|Duri (singer)
풍금|Pung Geum
마리아|Maria (trot singer)|Maria (South Korean singer)
배아현|Bae Ah Hyun|Bae Ah-hyun
정서주|Jung Seo Joo|Jeong Seo-ju
오유진|Oh Yu Jin|Oh Yu-jin (singer)
김의영|Kim Eui Young|Kim Eui-young
정미애|Jung Mi Ae|Jung Mi-ae
숙행|Sook Haeng|Sook Haeng
윤태화|Yoon Tae Hwa|Yoon Tae-hwa
이미자|Lee Mi Ja|Lee Mi-ja
하춘화|Ha Chun Hwa|Ha Chun-hwa
문주란|Moon Joo Ran|Moon Joo-ran
최숙자|Choi Sook Ja
김상희|Kim Sang Hee|Kim Sang-hee
정훈희|Jung Hoon Hee|Jeong Hun-hee
조미미|Jo Mi Mi|Jo Mi-mi
김세레나|Kim Serena|Kim Serena
방실이|Bang Sil I|Bang Sil-i
윤복희|Yoon Bok Hee|Yoon Bok-hee
패티김|Patti Kim|Patti Kim
백설희|Baek Seol Hee|Baek Seol-hee
이난영|Lee Nan Young|Lee Nan-young
장은숙|Jang Eun Sook|Jang Eun-sook
정재은|Cheuni|Cheuni
김혜연|Kim Hye Yeon|Kim Hye-yeon (singer)
김양|Kim Yang|Kim Yang (singer)
한봄|Han Bom
김추리|Kim Churi
김유라|Kim Yu Ra (trot singer)
최양숙|Choi Yang Sook|Choi Yang-sook
`);

add(['folk'], 'male', 'solo', `
김창완|Kim Chang Wan|Kim Chang-wan
정태춘|Jeong Tae Chun|Jeong Tae-chun
강산에|Kang San Eh|Kang San-e
장사익|Jang Sa Ik|Jang Sa-ik
한대수|Hahn Dae Soo|Hahn Dae-soo
송창식|Song Chang Sik|Song Chang-sik
윤형주|Yoon Hyung Joo|Yoon Hyung-joo
김세환|Kim Se Hwan|Kim Se-hwan (singer)
박학기|Park Hak Ki|Park Hak-ki
한동준|Han Dong Joon|Han Dong-joon
이규석|Lee Kyu Seok|Lee Kyu-seok
홍서범|Hong Seo Beom|Hong Seo-beom
김종환|Kim Jong Hwan|Kim Jong-hwan
유재하|Yoo Jae Ha|Yoo Jae-ha
이문세|Lee Moon Sae|Lee Moon-sae
최백호|Choi Baek Ho|Choi Baek-ho
김목경|Kim Mok Kyung|Kim Mok-kyung
이정선|Lee Jung Sun|Lee Jung-sun
임지훈|Lim Ji Hoon|Lim Ji-hoon
김현식|Kim Hyun Sik|Kim Hyun-sik
조덕배|Cho Deok Bae|Cho Deok-bae
김두수|Kim Doo Soo|Kim Doo-soo
정원영|Jung Won Young|Jung Won-young
`);
add(['folk'], 'female', 'solo', `
양희은|Yang Hee Eun|Yang Hee-eun
박은옥|Park Eun Ok|Park Eun-ok
한영애|Han Young Ae|Han Young-ae
강수지|Kang Susie|Kang Su-sie
이상은|Lee Sang Eun|Lee Sang-eun (singer)|Lee Tzsche
민해경|Min Hae Kyung|Min Hae-kyung
원미연|Won Mi Yeon|Won Mi-yeon
윤시내|Yoon Si Nae|Yoon Si-nae
박강수|Park Kang Soo|Park Kang-soo
김희진|Kim Hee Jin (folk singer)
이연실|Lee Yeon Sil|Lee Yeon-sil
은희|Eun Hee|Eun Hee
우순실|Woo Soon Sil|Woo Soon-sil
양수경|Yang Soo Kyung|Yang Soo-kyung
박지윤|Park Ji Yoon|Park Ji-yoon
`);
add(['folk'], 'male', 'group', `
트윈폴리오|Twin Folio|Twin Folio
해바라기|Sunflower|Sunflower (South Korean band)
둘다섯|Dul Daseot
어니언스|Onions|Onions (band)
사월과오월|April and May
동물원|Zoo|Zoo (band)
자전거탄풍경|Jatanpung|Jatanpung
여행스케치|Travel Sketch|Travel Sketch
유리상자|Yurisangja|Yurisangja
김창완밴드|Kim Chang Wan Band|Kim Chang-wan Band
`);

add(['jazz', 'rnb'], 'female', 'solo', `
웅산|Woong San|WoongSan
나윤선|Youn Sun Nah|Youn Sun Nah
말로|Malo|Malo (singer)
박성연|Park Sung Yeon|Park Sung-yeon
나희경|Hee Kyung Na
박라온|Park Ra On
허소영|Heo So Young
김혜미|Kim Hye Mi (jazz singer)
`);
add(['jazz', 'rnb'], 'male', 'solo', `
김주환|Kim Ju Hwan (jazz singer)
이동우|Lee Dong Woo|Lee Dong-woo (entertainer)
`);

add(['crossover', 'ballad'], 'male', 'group', `
포레스텔라|Forestella|Forestella
라포엠|LA POEM|La Poem
리베란테|Libelante|Libelante
포르테디콰트로|Forte di Quattro|Forte di Quattro
포르테나|Fortena|Fortena
크레즐|CREZL|Crezl
에델라인클랑|Edel Reinklang|Edel Reinklang
흉스프레소|Hpresso
`);
add(['crossover'], 'female', 'solo', `
조수미|Sumi Jo|Sumi Jo
임선혜|Sunhae Im|Sunhae Im
홍혜경|Hei Kyung Hong|Hei-kyung Hong
`);
add(['gugak', 'folk'], 'female', 'solo', `
송소희|Song So Hee|Song So-hee
추다혜|Chu Da Hye|Chu Da-hye
김나니|Kim Na Ni|Kim Na-ni
박애리|Park Ae Ri|Park Ae-ri
김영임|Kim Young Im|Kim Young-im
민은경|Min Eun Kyung
`);
add(['gugak', 'crossover'], 'male', 'solo', `
고영열|Ko Young Yeol|Ko Young-yeol
김준수|Kim Jun Su (gugak singer)||국악 김준수,소리꾼 김준수
`);
add(['gugak', 'rock'], 'mixed', 'group', `
이날치|LEENALCHI|Leenalchi
악단광칠|ADG7|Ak Dan Gwang Chil
잠비나이|Jambinai|Jambinai
추다혜차지스|CHUDAHYE CHAGIS
두번째달|Second Moon|Second Moon (band)
`);

add(['trot'], 'male', 'solo', `
나상도|Na Sang Do||나상도
`);
add(['rock'], 'male', 'group', `
이지|Izi|Izi (band)
`);
add(['ballad'], 'female', 'group', `
태사비애|Taesabiae
`);
add(['ballad'], 'male', 'solo', `
송이한|Song I Han
`);
add(['ballad', 'rnb'], 'mixed', 'group', `
에이트|8Eight|8Eight
`);
add(['ballad'], 'mixed', 'group', `
디에이드|The Ade|The Ade
`);
add(['rnb'], 'male', 'solo', `
챈슬러|Chancellor|Chancellor (musician)
`);
add(['rock'], 'female', 'solo', `
서문탁|Seo Moon Tak|Seo Moon-tak
`);
add(['rock'], 'mixed', 'group', `
카디|KARDI|Kardi
`);
add(['rock', 'rnb'], 'mixed', 'group', `
롤러코스터|Roller Coaster|Roller Coaster (band)
`);
add(['indie', 'folk'], 'female', 'solo', `
안예슬|Ahn Ye Seul|Ahn Ye-seul
`);
add(['indie', 'folk'], 'mixed', 'group', `
김사월김해원|Kim Sawol and Kim Haewon||김해원
`);
add(['indie', 'folk'], 'female', 'solo', `
김마리|Kim Mari
`);
add(['indie', 'folk'], 'female', 'solo', `
한올|Han All
`);
add(['indie', 'folk'], 'male', 'solo', `
김일두|Kim Il Du
`);
add(['ballad'], 'male', 'group', `
순순희|SoonSoonHee
`);
add(['indie', 'folk'], 'female', 'group', `
제이레빗|J Rabbit|J Rabbit
`);
add(['indie', 'folk'], 'male', 'solo', `
에피톤프로젝트|Epitone Project|Epitone Project
`);
add(['indie', 'rock'], 'male', 'solo', `
달빛요정역전만루홈런|Moonlight Fairy|Moonlight Fairy Grand Slam Homerun
`);
add(['indie', 'rock'], 'mixed', 'group', `
브로콜리너마저|Broccoli you too|Broccoli, You Too
`);
add(['indie', 'rock'], 'mixed', 'group', `
허클베리핀|Huckleberry Finn|Huckleberry Finn (band)
`);
add(['ballad', 'indie'], 'male', 'group', `
멜로망스|MeloMance|MeloMance
`);
add(['indie', 'folk'], 'male', 'group', `
옥수사진관|Oksoo Photo Studio
`);
add(['trot'], 'female', 'solo', `
김수희|Kim Soo Hee|Kim Soo-hee
`);
add(['trot'], 'female', 'solo', `
한혜진|Han Hye Jin (trot singer)|Han Hye-jin (singer)
`);
add(['trot'], 'female', 'solo', `
송민도|Song Min Do|Song Min-do
`);
add(['jazz', 'rock'], 'male', 'group', `
정원영밴드|Jung Won Young Band
`);
add(['jazz'], 'mixed', 'group', `
윈터플레이|Winterplay|Winterplay
`);
add(['indie', 'folk'], 'female', 'solo', `
안녕하신가영|Hello Gayoung||Hello Ga Young
김동희|Kim Dong Hee|Kim Dong-hee (singer)
`);
add(['dance'], 'female', 'group', `
포미닛|4Minute|4Minute|현아
천상지희|The Grace|The Grace|다나
`);

add(['indie', 'dance'], 'mixed', 'group', `
아도이|ADOY|Adoy
`);
add(['gugak', 'rock'], 'male', 'group', `
서도밴드|sEODo BAND|Seodo Band
`);


add(['ballad'], 'male', 'solo', `
조장혁|Cho Jang Hyuk|Jo Jang-hyuk
최성수|Choi Sung Soo|Choi Sung-soo
이상우|Lee Sang Woo|Lee Sang-woo (singer)
이용|Lee Yong|Lee Yong (singer)
이범학|Lee Bum Hak|Lee Beom-hak
이무송|Lee Moo Song|Lee Moo-song
`);
add(['ballad'], 'female', 'solo', `
알리|ALi|Ali (South Korean singer)
오현란|Oh Hyun Ran|Oh Hyun-ran
박혜경|Park Hye Kyung|Park Hye-kyung
천단비|Cheon Dan Bi|Cheon Dan-bi
미|MIIII|MIIII
김그림|Kim Greem|Kim Greem
이예린|Lee Ye Rin|Lee Ye-rin
하수빈|Ha Soo Bin|Ha Soo-bin
최연제|Choi Yeon Je
김태영|Kim Tae Young (female singer)
`);
add(['rnb', 'ballad'], 'male', 'solo', `
문명진|Moon Myung Jin|Moon Myung-jin
더레이|The Ray|The Ray (singer)
`);
add(['rock', 'ballad'], 'female', 'solo', `
김윤아|Kim Yoon Ah|Kim Yoon-ah
소찬휘|So Chan Whee|So Chan-whee
김보경|Kim Bo Kyung|Kim Bo-kyung (singer)
`);
add(['dance'], 'female', 'solo', `
김현정|Kim Hyun Jung|Kim Hyun-jung (singer)
박미경|Park Mi Kyung|Park Mi-kyung
이정현|Lee Jung Hyun|Lee Jung-hyun
장나라|Jang Na Ra|Jang Na-ra
`);
add(['ballad', 'indie'], 'male', 'solo', `
토이|Toy||유희열
윤상|Yoon Sang|Yoon Sang
김지수|Kim Ji Soo|Kim Ji-soo (singer)
`);
add(['indie', 'folk'], 'male', 'solo', `
유승우|Yoo Seung Woo|Yoo Seung-woo
`);
add(['indie', 'folk'], 'female', 'solo', `
장재인|Jang Jane|Jang Jae-in
`);
add(['rnb', 'dance'], 'mixed', 'group', `
클래지콰이|Clazziquai|Clazziquai Project
`);
add(['indie', 'dance'], 'male', 'solo', `
허밍어반스테레오|Humming Urban Stereo|Humming Urban Stereo
`);
add(['folk'], 'mixed', 'group', `
노래를찾는사람들|People Who Seek Songs|People who seek songs|노찾사,노래를 찾는 사람들
`);
add(['ballad'], 'female', 'solo', `
김태정|Kim Tae Jung
`);

export const EXTRA_ARTISTS = additions;
