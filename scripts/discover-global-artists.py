"""Discover foreign performers from Bugs' dated overseas genre charts.

This is an acquisition tool, not a live search heuristic. Canonical artist
profiles establish country, type, composition, photo and credited recordings.
Its candidate output is published only after independently verifying a
YouTube Music identity, complete catalog and usable local profile image.
"""
import argparse
import concurrent.futures
import html
import fcntl
import json
import os
import re
import threading
import time
import unicodedata
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path(os.environ.get('TIER_GLOBAL_CACHE', str(ROOT / '.runtime/global-expansion')))
CACHE.mkdir(parents=True, exist_ok=True)
LOCAL = threading.local()
LOCK = threading.Lock()
LAST = 0.0
UNAVAILABLE = threading.Event()
GENRES = {
    'pop/pop': 'dance', 'pop/hiphop': 'hiphop', 'pop/rnb': 'rnb',
    'pop/elec': 'dance', 'pop/rock': 'rock', 'pop/metal': 'rock',
    'pop/jazz': 'jazz', 'etc/njpop': 'dance', 'etc/nwpop': 'folk',
}
PRIORITY = """Justin Timberlake|Britney Spears|Christina Aguilera|Selena Gomez|Demi Lovato|Jessica Simpson|Hilary Duff|Destiny's Child|Kelly Clarkson|Carrie Underwood|Shania Twain|Dolly Parton|Faith Hill|Garth Brooks|Tim McGraw|Kenny Chesney|Luke Bryan|Blake Shelton|Miranda Lambert|Maren Morris|Kacey Musgraves|Lainey Wilson|Chris Stapleton|Keith Urban|Brad Paisley|Sheryl Crow|LeAnn Rimes|Alanis Morissette|Fiona Apple|Tori Amos|Regina Spektor|Norah Jones|Katie Melua|Diana Krall|Madeleine Peyroux|Melody Gardot|Corinne Bailey Rae|Joss Stone|Duffy|Jessie J|Rita Ora|Ellie Goulding|Leona Lewis|Emeli Sandé|James Arthur|James Bay|James Blunt|Lewis Capaldi|Tom Walker|Tom Odell|George Ezra|Rag'n'Bone Man|Paolo Nutini|Ben Howard|Passenger|Jack Johnson|Jason Mraz|Gavin DeGraw|Rob Thomas|Matchbox Twenty|Train|The Fray|Keane|Travis|Snow Patrol|Stereophonics|The Script|The Goo Goo Dolls|Creed|Nickelback|3 Doors Down|Incubus|Deftones|Korn|Limp Bizkit|Slipknot|System Of A Down|Disturbed|Avenged Sevenfold|Breaking Benjamin|Three Days Grace|Papa Roach|Evanescence|Nightwish|Within Temptation|Epica|Lacuna Coil|The Pretty Reckless|Halestorm|Ghost|Gojira|Mastodon|Tool|A Perfect Circle|Nine Inch Nails|Marilyn Manson|Rammstein|Iron Maiden|Judas Priest|Megadeth|Slayer|Anthrax|Motorhead|Dio|Ozzy Osbourne|Black Sabbath|Deep Purple|Rainbow|Whitesnake|Def Leppard|Scorpions|Europe|Mr. Big|Extreme|Skid Row|Poison|Mötley Crüe|Van Halen|Journey|Foreigner|Boston|Kansas|Styx|Toto|Chicago|The Eagles|Fleetwood Mac|Steely Dan|Dire Straits|The Police|Sting|Genesis|Phil Collins|Peter Gabriel|Yes|King Crimson|Rush|Jethro Tull|Emerson, Lake & Palmer|The Who|The Kinks|The Doors|Cream|The Velvet Underground|The Beach Boys|The Byrds|Simon & Garfunkel|Cat Stevens|Carole King|James Taylor|Joni Mitchell|Joan Baez|Neil Young|Leonard Cohen|Tom Waits|Nick Cave & The Bad Seeds|PJ Harvey|Patti Smith|Lou Reed|Iggy Pop|The Stooges|Ramones|Sex Pistols|The Clash|Talking Heads|Blondie|The Cars|Duran Duran|Depeche Mode|New Order|Joy Division|The Smiths|The Cure|Pet Shop Boys|Tears For Fears|A-ha|Erasure|Eurythmics|Culture Club|Spandau Ballet|Simple Minds|INXS|R.E.M.|Pixies|Sonic Youth|Dinosaur Jr.|Pavement|My Bloody Valentine|Slowdive|Cocteau Twins|The Jesus And Mary Chain|Ride|Lush|Belle & Sebastian|The Stone Roses|Pulp|Suede|Manic Street Preachers|Placebo|Muse|Interpol|Editors|White Lies|The National|The War On Drugs|Bon Iver|Fleet Foxes|Sufjan Stevens|Iron & Wine|José González|Damien Rice|Jeff Buckley|Elliott Smith|Bright Eyes|Death Cab For Cutie|The Postal Service|Modest Mouse|Built To Spill|Wilco|Beck|Spoon|The Shins|MGMT|Foster The People|Vampire Weekend|Phoenix|Two Door Cinema Club|Franz Ferdinand|Bloc Party|The Libertines|The Kooks|Kasabian|Kaiser Chiefs|Foals|Alt-J|Glass Animals|Bastille|BØRNS|The 1975|LANY|HONNE|Oh Wonder|Aquilo|Kodaline|Seafret|Nothing But Thieves|Royal Blood|Yungblud|Palaye Royale|Sleep Token|Bad Omens|Bring Me The Horizon|Architects|Asking Alexandria|A Day To Remember|Bullet For My Valentine|Killswitch Engage|Trivium|Lamb Of God|Opeth|Porcupine Tree|Steven Wilson|Dream Theater|Symphony X|Helloween|Blind Guardian|Sabaton|Powerwolf|DragonForce|Alestorm|Apocalyptica|Eluveitie|Amon Amarth|In Flames|Dark Tranquillity|Children Of Bodom|Arch Enemy|Behemoth|Dimmu Borgir|Meshuggah|Lorna Shore|Whitechapel|Suicide Silence|Cannibal Corpse|Death|Sepultura|Kreator|Testament|Exodus|Machine Head|Fear Factory|Static-X|Sum 41|Good Charlotte|Simple Plan|The Offspring|Rancid|Bad Religion|NOFX|Pennywise|Rise Against|All Time Low|Mayday Parade|We The Kings|The Used|Taking Back Sunday|Jimmy Eat World|Dashboard Confessional|Brand New|AFI|Yellowcard|New Found Glory|Motion City Soundtrack|Alkaline Trio|Panic! At The Disco|Fall Out Boy|My Chemical Romance|Thirty Seconds To Mars|Twenty One Pilots|AJR|Fun.|Fitz And The Tantrums|Walk The Moon|X Ambassadors|American Authors|Portugal. The Man|Cage The Elephant|Grouplove|Young The Giant|The Neighbourhood|Chase Atlantic|Wallows|Dayglow|Rex Orange County|Boy Pablo|Cuco|Omar Apollo|Steve Lacy|Dominic Fike|Clairo|Beabadoobee|Men I Trust|Faye Webster|Laufey|Mitski|Japanese Breakfast|Phoebe Bridgers|Lucy Dacus|Julien Baker|boygenius|Soccer Mommy|Snail Mail|Lizzy McAlpine|Gracie Abrams|Holly Humberstone|Maisie Peters|Sasha Alex Sloan|Madison Beer|Tate McRae|Raye|PinkPantheress|Zara Larsson|Tove Lo|MØ|Robyn|Lykke Li|Sigrid|Aurora|Agnes Obel|Ane Brun|Susanne Sundfør|Björk|Sigur Rós|Of Monsters And Men|KALEO|Asgeir|Trentemøller|Röyksopp|The Knife|Fever Ray|Little Dragon|Jungle|Parcels|Khruangbin|Unknown Mortal Orchestra|Mac DeMarco|King Krule|King Gizzard & The Lizard Wizard|Pond|The Flaming Lips|The Black Keys|The White Stripes|Jack White|The Raconteurs|The Dead Weather|Alabama Shakes|Brittany Howard|Gary Clark Jr.|Joe Bonamassa|Stevie Ray Vaughan|B.B. King|Muddy Waters|John Lee Hooker|Buddy Guy|Howlin' Wolf|Robert Johnson|Etta James|Nina Simone|Billie Holiday|Sarah Vaughan|Ella Fitzgerald|Louis Armstrong|Nat King Cole|Frank Sinatra|Tony Bennett|Dean Martin|Bing Crosby|Sammy Davis Jr.|Nina Simone|Sade|Simply Red|Seal|George Michael|Wham!|Lionel Richie|Diana Ross|The Supremes|The Temptations|The Four Tops|The Jackson 5|Earth, Wind & Fire|Kool & The Gang|Chic|The Commodores|The Isley Brothers|Parliament|Funkadelic|Rick James|Barry White|Al Green|Marvin Gaye|Otis Redding|Wilson Pickett|Curtis Mayfield|Smokey Robinson|Sam Cooke|James Brown|Ray Charles|Aretha Franklin|Patti LaBelle|Gladys Knight|Chaka Khan|Dionne Warwick|Donna Summer|Gloria Gaynor|Anita Baker|Toni Braxton|Brandy|Monica|Aaliyah|Ashanti|Mya|Keyshia Cole|Ciara|Cassie|Kelis|Amerie|Jhené Aiko|Kehlani|Tinashe|Victoria Monét|Summer Walker|Ella Mai|Snoh Aalegra|Jorja Smith|Mahalia|Cleo Sol|Sabrina Claudio|Alina Baraz|Kiana Ledé|Muni Long|Coco Jones|Ari Lennox|Yebba|Ravyn Lenae|Rochelle Jordan|Nao|Syd|The Internet|Jill Scott|India.Arie|Erykah Badu|Lauryn Hill|Fugees|D'Angelo|Maxwell|Musiq Soulchild|Anthony Hamilton|John Legend|Robin Thicke|Ne-Yo|Usher|Chris Brown|Trey Songz|Mario|Omarion|Miguel|Jeremih|Ty Dolla $ign|PARTYNEXTDOOR|Bryson Tiller|6LACK|Jacquees|Lucky Daye|Giveon|Daniel Caesar|Brent Faiyaz|Sampha|Masego|SiR|Gallant|Moses Sumney|Leon Bridges|Durand Jones & The Indications|Michael Kiwanuka|Tom Misch|Jordan Rakei|FKJ|Yussef Dayes|Thundercat|Robert Glasper|Kamasi Washington|Terrace Martin|BADBADNOTGOOD|Hiatus Kaiyote|Moonchild|Ezra Collective|Nubya Garcia|Snarky Puppy|Esperanza Spalding|Lianne La Havas|Dwele|Bilal|Raphael Saadiq|Donell Jones|Joe|112|Boyz II Men|Jodeci|Dru Hill|Blackstreet|TLC|SWV|En Vogue|Xscape|Total|702|Jagged Edge|New Edition|Bobby Brown|Keith Sweat|Bell Biv DeVoe|LL Cool J|Ice Cube|Ice-T|N.W.A|Public Enemy|Run-D.M.C.|Beastie Boys|Wu-Tang Clan|Method Man|Redman|Raekwon|Ghostface Killah|GZA|Ol' Dirty Bastard|KRS-One|Rakim|Eric B. & Rakim|Big Daddy Kane|Slick Rick|EPMD|De La Soul|A Tribe Called Quest|The Pharcyde|Gang Starr|Guru|DJ Premier|Pete Rock & C.L. Smooth|Mobb Deep|Big Pun|Fat Joe|DMX|Ja Rule|Jadakiss|The LOX|Cam'ron|Dipset|Jim Jones|Juelz Santana|Fabolous|Lloyd Banks|The Game|Busta Rhymes|Missy Elliott|Eve|Lil' Kim|Foxy Brown|Queen Latifah|Salt-N-Pepa|MC Lyte|Da Brat|Trina|Remy Ma|Nicki Minaj|Cardi B|Megan Thee Stallion|Doja Cat|Latto|Saweetie|GloRilla|Ice Spice|Sexyy Red|Doechii|Flo Milli|Rico Nasty|Little Simz|Noname|Rapsody|Tierra Whack|Young M.A|Teezo Touchdown|Outkast|André 3000|Big Boi|Goodie Mob|CeeLo Green|Ludacris|T.I.|Jeezy|Gucci Mane|Rick Ross|Wale|Meek Mill|French Montana|Diddy|Mase|Nelly|Chingy|Bow Wow|Soulja Boy|Fetty Wap|Flo Rida|Pitbull|Sean Paul|Shaggy|Akon|T-Pain|Lil Jon|Ying Yang Twins|Three 6 Mafia|Juicy J|Project Pat|UGK|Bun B|Pimp C|Scarface|Geto Boys|Slim Thug|Paul Wall|Mike Jones|Chamillionaire|Z-Ro|Trae Tha Truth|Tech N9ne|Twista|Bone Thugs-N-Harmony|Bizzy Bone|Krayzie Bone|Hopsin|Dizzy Wright|Joyner Lucas|NF|Logic|Token|Tom MacDonald|G-Eazy|Machine Gun Kelly|Yelawolf|Kid Ink|Tyga|YG|YG Marley|Nipsey Hussle|Vince Staples|Earl Sweatshirt|Domo Genesis|Hodgy|Odd Future|Denzel Curry|JID|EarthGang|Saba|Mick Jenkins|Isaiah Rashad|Ab-Soul|ScHoolboy Q|Jay Rock|REASON|Joey Bada$$|Flatbush Zombies|The Underachievers|Brockhampton|Kevin Abstract|Danny Brown|JPEGMAFIA|Run The Jewels|Killer Mike|El-P|Billy Woods|Armand Hammer|MIKE|Navy Blue|Your Old Droog|Roc Marciano|Westside Gunn|Conway The Machine|Benny The Butcher|Boldy James|Freddie Gibbs|Curren$y|Larry June|Action Bronson|The Alchemist|MF DOOM|Madlib|J Dilla|Nujabes|DJ Shadow|Flying Lotus|Aesop Rock|Atmosphere|Brother Ali|Immortal Technique|Cannibal Ox|Deltron 3030|Hieroglyphics|Souls Of Mischief|Del The Funky Homosapien|Jurassic 5|Dilated Peoples|People Under The Stairs|CunninLynguists|Little Brother|Phonte|Murs|Lupe Fiasco|Common|Talib Kweli|Mos Def|Black Star|Chance The Rapper|Vic Mensa|Childish Gambino|Kid Cudi|Big Sean|Wiz Khalifa|Mac Miller|Lil Uzi Vert|Playboi Carti|Lil Yachty|Lil Baby|Gunna|Young Thug|21 Savage|Future|Travis Scott|Don Toliver|Quavo|Offset|Takeoff|Migos|Lil Durk|Polo G|Rod Wave|NBA YoungBoy|Kodak Black|NLE Choppa|Moneybagg Yo|Yo Gotti|Young Dolph|Key Glock|EST Gee|42 Dugg|Lil Tjay|A Boogie Wit Da Hoodie|Pop Smoke|Fivio Foreign|Sleepy Hallow|Sheff G|Central Cee|Dave|Stormzy|Skepta|JME|Wiley|Dizzee Rascal|Kano|Ghetts|AJ Tracey|Headie One|D-Block Europe|Digga D|Fredo|Aitch|ArrDee|Russ|Russ Millions|Bugzy Malone|Slowthai|Knucks|Loyle Carner|Wretch 32|Nines|Potter Payper|Giggs|D Double E|Krept & Konan|Bad Bunny|J Balvin|Ozuna|Maluma|Daddy Yankee|Don Omar|Wisin & Yandel|Nicky Jam|Rauw Alejandro|Feid|Myke Towers|Anuel AA|Karol G|Becky G|Natti Natasha|Rosalía|Shakira|Enrique Iglesias|Ricky Martin|Luis Fonsi|Marc Anthony|Romeo Santos|Prince Royce|Aventura|Juanes|Carlos Vives|Maná|Santana|Bomba Estéreo|Natalia Lafourcade|Mon Laferte|Julieta Venegas|Jorge Drexler|Caetano Veloso|Gilberto Gil|Chico Buarque|João Gilberto|Antonio Carlos Jobim|Astrud Gilberto|Elis Regina|Gal Costa|Maria Bethânia|Marisa Monte|Djavan|Milton Nascimento|Seu Jorge|Bebel Gilberto|Sergio Mendes|Anitta|Pabllo Vittar|Alok|Ivete Sangalo|Ludmilla|Luan Santana|Gusttavo Lima|Jorge & Mateus|Marília Mendonça|Peso Pluma|Natanael Cano|Junior H|Fuerza Regida|Grupo Frontera|Carin León|Christian Nodal|Danny Ocean|Sebastián Yatra|Camilo|Morat|Reik|CNCO|Danna Paola|Tini|Aitana|Lola Índigo|Nathy Peluso|C. Tangana|Rels B|Quevedo|Bizarrap|Duki|Trueno|Nicki Nicole|Tiago PZK|Maria Becerra|Emilia|Khea|Dread Mar-I|Los Fabulosos Cadillacs|Soda Stereo|Gustavo Cerati|Fito Páez|Charly García|Luis Miguel|Alejandro Sanz|Pablo Alborán|David Bisbal|Chayanne|Thalía|Paulina Rubio|Gloria Estefan|Celia Cruz|Buena Vista Social Club|Rubén Blades|Héctor Lavoe|Willie Colón|El Gran Combo De Puerto Rico|Bob Marley & The Wailers|Peter Tosh|Jimmy Cliff|Toots & The Maytals|Burning Spear|Steel Pulse|UB40|Inner Circle|Damian Marley|Stephen Marley|Ziggy Marley|Julian Marley|Chronixx|Protoje|Koffee|Popcaan|Vybz Kartel|Buju Banton|Sizzla|Beenie Man|Bounty Killer|Spice|Burna Boy|Wizkid|Davido|Tems|Ayra Starr|Rema|Asake|Omah Lay|Fireboy DML|Joeboy|CKay|Tiwa Savage|Yemi Alade|Mr Eazi|Patoranking|Diamond Platnumz|Sauti Sol|Tyla|Black Coffee|Master KG|Makhadzi|Amaarae|Fally Ipupa|Angélique Kidjo|Youssou N'Dour|Salif Keita|Ali Farka Touré|Tinariwen|Bombino|Fatoumata Diawara|Oumou Sangaré|Miriam Makeba|Hugh Masekela|Fela Kuti|Femi Kuti|Seun Kuti|Sade Adu|Cheb Khaled|Cheb Mami|Stromae|Angèle|Aya Nakamura|Gims|Dadju|Ninho|PNL|Booba|SCH|Jul|Soprano|Orelsan|Lomepal|Damso|Nekfeu|MC Solaar|IAM|NTM|Zaz|Indila|Louane|Clara Luciani|Christine And The Queens|Pomme|Vanessa Paradis|Carla Bruni|Françoise Hardy|France Gall|Jane Birkin|Serge Gainsbourg|Jacques Brel|Édith Piaf|Charles Aznavour|Dalida|Johnny Hallyday|Mylène Farmer|Patricia Kaas|Céline Dion|Lara Fabian|Garou|Patrick Bruel|Francis Cabrel|Jean-Jacques Goldman|Alain Souchon|Véronique Sanson|Michel Polnareff|Michel Sardou|Patrick Fiori|Kendji Girac|Vianney|Slimane|Vitaa|Amir|Hoshi|Suzane|Yseult|L'Impératrice|Polo & Pan|La Femme|Air|M83|Justice|Kavinsky|Gesaffelstein|Daft Punk|Cassius|Modjo|Martin Solveig|David Guetta|Bob Sinclar|Laurent Garnier|Jean-Michel Jarre|Kraftwerk|Tangerine Dream|Vangelis|Giorgio Moroder|Fatboy Slim|The Chemical Brothers|The Prodigy|Underworld|Orbital|The Orb|Basement Jaxx|Groove Armada|Faithless|Massive Attack|Portishead|Tricky|Morcheeba|Zero 7|Thievery Corporation|Kruder & Dorfmeister|Tosca|Bonobo|Ninja Tune|Nicolas Jaar|Darkside|Four Tet|Caribou|Bicep|Floating Points|Jamie xx|The xx|James Blake|Burial|Aphex Twin|Boards Of Canada|Autechre|Squarepusher|Jon Hopkins|Max Cooper|Nils Frahm|Ólafur Arnalds|Kiasmos|Tycho|Emancipator|Lemon Jelly|The Avalanches|DJ Koze|Rival Consoles|Moderat|Modeselektor|Apparat|Paul Kalkbrenner|Ben Böhmer|Lane 8|Tinlicker|Yotto|Luttrell|Sultan + Shepard|Rufus Du Sol|Odesza|Flume|Chet Faker|Nick Murphy|Flight Facilities|Hayden James|Gryffin|Illenium|Seven Lions|Said The Sky|Dabin|San Holo|Porter Robinson|Madeon|Skrillex|Diplo|Major Lazer|Jack Ü|DJ Snake|Marshmello|Alan Walker|Kygo|Avicii|Calvin Harris|Zedd|The Chainsmokers|Clean Bandit|Galantis|Disclosure|Sam Feldt|Robin Schulz|Lost Frequencies|Felix Jaehn|Jonas Blue|Sigala|Jax Jones|Duke Dumont|Gorgon City|MK|MEDUZA|FISHER|Chris Lake|Dom Dolla|John Summit|Mau P|Fred Again..|Swedish House Mafia|Axwell|Sebastian Ingrosso|Steve Angello|Alesso|Nicky Romero|Hardwell|Afrojack|R3HAB|KSHMR|W&W|Dimitri Vegas & Like Mike|Blasterjaxx|Bassjackers|Quintino|DVBBS|Borgeous|Vicetone|Don Diablo|Oliver Heldens|Tchami|Malaa|AC Slater|Habstrakt|JOYRYDE|Moksi|Loopers|Curbi|BROHUG|Armin Van Buuren|Tiësto|Paul Van Dyk|Ferry Corsten|Above & Beyond|Andrew Bayer|Ilan Bluestone|Cosmic Gate|ATB|Dash Berlin|Gareth Emery|Markus Schulz|Aly & Fila|Astrix|Infected Mushroom|Vini Vici|Boris Brejcha|Charlotte De Witte|Amelie Lens|Nina Kraviz|Adam Beyer|Carl Cox|Richie Hawtin|Dubfire|Solomun|Dixon|Âme|Tale Of Us|ARTBAT|Adriatique|Mind Against|Reinier Zonneveld|Peggy Gou|Tokimonsta|Qrion|Yaeji|Nora En Pure|LP Giobbi|ANNA|Indira Paganotto|Sara Landry|Sofi Tukker|Krewella|Nervo|Icona Pop|Kiiara|Aluna|AlunaGeorge|Jess Glynne|Anne-Marie|Bebe Rexha|Ava Max|Daya|Maggie Lindemann|Charlotte Lawrence|Sabrina Carpenter|Chappell Roan|Olivia Rodrigo|Conan Gray|Benson Boone|Alex Warren|d4vd|Stephen Sanchez|David Kushner|JVKE|Alec Benjamin|Alexander 23|Jeremy Zucker|Chelsea Cutler|Quinn XCII|Lauv|Troye Sivan|Sam Smith|Years & Years|Olly Alexander|Mika|Adam Lambert|Scissor Sisters|Jake Shears|Rufus Wainwright|Perfume Genius|Orville Peck|Omar Rudberg|Kim Petras|Slayyyter|Dorian Electra|Ashnikko|Poppy|Grimes|FKA Twigs|Caroline Polachek|Charli XCX|Sophie|Arca|Sega Bodega|A. G. Cook|Hannah Diamond|Shygirl|COBRAH|Dua Lipa|Kylie Minogue|Dannii Minogue|Natalie Imbruglia|Delta Goodrem|Sia|Birdy|Gabrielle Aplin|Freya Ridings|Lauren Spencer Smith|Natalie Jane|Nessa Barrett|Addison Rae|Reneé Rapp|Fletcher|King Princess|Hayley Kiyoko|Girl In Red|MUNA|The Aces|HAIM|Wet Leg|The Last Dinner Party|Florence + The Machine|Bat For Lashes|Marina|Paloma Faith|Dido|Sarah McLachlan|Natalie Merchant|Lisa Loeb|Suzanne Vega|Shawn Colvin|Patty Griffin|Lucinda Williams|Emmylou Harris|Alison Krauss|Nanci Griffith|Mary Chapin Carpenter|Brandi Carlile|Gillian Welch|Aimee Mann|Jenny Lewis|Neko Case|Courtney Barnett|Julia Jacklin|Stella Donnelly|Angie McMahon|Big Thief|Adrianne Lenker|Waxahatchee|Angel Olsen|Sharon Van Etten|Weyes Blood|Beach House|Cigarettes After Sex|Mazzy Star|Hope Sandoval|Daughter|London Grammar|Wolf Alice|Warpaint|CHVRCHES|Purity Ring|Phantogram|Sylvan Esso|Chvrches|The Naked And Famous|Passion Pit|Empire Of The Sun|Cut Copy|Hot Chip|LCD Soundsystem|Friendly Fires|Metronomy|Future Islands|Roosevelt|Washed Out|Toro Y Moi|Neon Indian|Small Black|Wild Nothing|Craft Spells|DIIV|Real Estate|Beach Fossils|Alvvays|The Pains Of Being Pure At Heart|Yo La Tengo|Galaxie 500|Spiritualized|Spacemen 3|Brian Jonestown Massacre|The Dandy Warhols|Black Rebel Motorcycle Club|The Hives|The Vines|Jet|Wolfmother|The Darkness|Airbourne|Rival Sons|Greta Van Fleet|Dirty Honey|The Struts|Badflower|Highly Suspect|Cleopatrick|Des Rocs|Reignwolf|Dinosaur Pile-Up|Tigercub|Demob Happy|Dead Poet Society|Ready The Prince|Cleopatrick|The Warning|Band-Maid|BABYMETAL|Hanabie.|Lovebites|Nemophila|One Ok Rock|My First Story|Radwimps|Bump Of Chicken|Asian Kung-Fu Generation|Ellegarden|The Hiatus|Mono|Toe|Tricot|Mass Of The Fermenting Dregs|Polkadot Stingray|Yorushika|Zutomayo|Ryokuoushoku Shakai|Vaundy|Ado|Kenshi Yonezu|King Gnu|Official Hige Dandism|Mrs. Green Apple|Fujii Kaze|Aimyon|Yuuri|Yama|Eve|Natori|Tatsuya Kitani|Reol|Aimer|Milet|LiSA|Eir Aoi|Minami|Sayuri|EGOIST|ClariS|FripSide|Kalafina|FictionJunction|Yuki Kajiura|Yoko Kanno|Hiroyuki Sawano|SawanoHiroyuki[nZk]|Linked Horizon|Sound Horizon|Man With A Mission|Spyair|The Oral Cigarettes|UVERworld|Sid|Flow|Porno Graffitti|L'Arc-En-Ciel|Hyde|Vamps|X Japan|Yoshiki|Hide|Luna Sea|L'Arc-en-Ciel|Glay|L'Arc-en-Ciel|L'Arc-en-Ciel|Buck-Tick|Dir En Grey|The Gazette|Miyavi|Gackt|Malice Mizer|Versailles|Nightmare|Mucc|D'espairsRay|Plastic Tree|Sukekiyo|Dadaroma|Scandal|Silent Siren|Chatmonchy|Shishamo|Go!Go!7188|The Peggies|Hitsujibungaku|Chilli Beans.|Hump Back|Homecomings|Regal Lily|Supercar|Number Girl|Zazen Boys|Fishmans|Happy End|Yura Yura Teikoku|Soutaiseiriron|Cornelius|Sakanaction|Quruli|The Pillows|The Blue Hearts|The Cro-Magnons|The High-Lows|B'z|Mr. Children|Spitz|Southern All Stars|Keisuke Kuwata|Masaharu Fukuyama|Kazuyoshi Saito|Motohiro Hata|Shikao Suga|Yamazaki Masayoshi|Kobukuro|Yuzu|Sukima Switch|Ikimonogakari|Superfly|Misia|Hikaru Utada|Ayumi Hamasaki|Namie Amuro|Kumi Koda|BoA|Mai Kuraki|Zard|Every Little Thing|Do As Infinity|Globe|TRF|Speed|Dreams Come True|Chara|Judy And Mary|Yuki|Sheena Ringo|Tokyo Jihen|UA|Cocco|Hitomi|Tommy February6|Tommy Heavenly6|Kaela Kimura|Yui|Miwa|Leo Ieiri|Sakurako Ohara|Mone Kamishiraishi|Nana Mizuki|Maaya Sakamoto|Yui Horie|Yukari Tamura|Aya Hirano|Ayahi Takagaki|Haruka Tomatsu|Minori Chihara|Sumire Uesaka|Saori Hayami|Inori Minase|Aimi|Suzuko Mimori|Aina The End|BiSH|Perfume|Kyary Pamyu Pamyu|Atarashii Gakko!|Faky|XG|NiziU|AKB48|SKE48|NMB48|HKT48|Nogizaka46|Sakurazaka46|Hinatazaka46|Keyakizaka46|Morning Musume|Momoiro Clover Z|Babymetal|Arashi|SMAP|Tokio|V6|KinKi Kids|KAT-TUN|NEWS|Hey! Say! JUMP|Kis-My-Ft2|Sexy Zone|King & Prince|Snow Man|SixTONES|Naniwa Danshi|Travis Japan|JO1|INI|BE:FIRST|Da-ice|W-inds.|Lead|Exile|J Soul Brothers|Generations From Exile Tribe|The Rampage From Exile Tribe|Fantastic From Exile Tribe|Ballistik Boyz From Exile Tribe|Psychic Fever From Exile Tribe|Bullet Train|Dish//|M!LK|Sandaime J Soul Brothers|Uru|Aimer|Tuki.|Tani Yuuki|Ren|Wacci|Novelbright|Back Number|Suda Masaki|Takahashi Yu|Greeeen|Funky Monkey Babys|Orange Range|Aqua Timez|Def Tech|Rake|Ketsumeishi|Hilcrhyme|Shonan No Kaze|Creepy Nuts|Awich|Chanmina|AK-69|Bad Hop|Kohh|Yuki Chiba|Lex|JP The Wavy|Tohji|Kvi Baba|Watson|Jin Dogg|Salu|Punpee|Kreva|Rhymester|Zeebra|M-Flo|Rip Slyme|Home Made Kazoku|Nujabes|Wednesday Campanella|Daoko|Bim|Sirup|Iri|Skaai|VivaOla|Aile The Shota|Taichi Mukai|Furui Riho|Tonun|Eill|Airi Suzuki|Kenshi Yonezu|Tatsuro Yamashita|Mariya Takeuchi|Toshiki Kadomatsu|Junko Ohashi|Anri|Miki Matsubara|Taeko Onuki|Yasuha|Minako Yoshida|Tomoko Aran|Takako Mamiya|Kaoru Akimoto|Makoto Matsushita|Masayoshi Takanaka|Casiopea|T-Square|Yellow Magic Orchestra|Ryuichi Sakamoto|Haruomi Hosono|Yukihiro Takahashi|Akiko Yano|Seiko Matsuda|Akina Nakamori|Kyoko Koizumi|Momoe Yamaguchi|Yumi Matsutoya|Miyuki Nakajima|Yosui Inoue|Takuro Yoshida|Koji Tamaki|Anzen Chitai|Koji Kikkawa|Hideaki Tokunaga|Masayuki Suzuki|Toshinobu Kubota|Kiyoshiro Imawano|RC Succession|Noriyuki Makihara|Chage And Aska|Yutaka Ozaki|Hound Dog|The Alfee|Boowy|Tomoyasu Hotei|Kyosuke Himuro|T.M.Revolution|Abingdon Boys School|Access|Daisuke Asakura|Lirico|Angela|Jam Project|Masaaki Endoh|Hironobu Kageyama|Akira Kushida|Ichiro Mizuki|Isao Sasaki|Masato Shimon|Nobuo Uematsu|Joe Hisaishi|Yoko Shimomura|Goose House|Goose House|Frederic|KANA-BOON|Kana Nishino|AI|Juju|Crystal Kay|Thelma Aoyama|BENI|Shota Shimizu|Daichi Miura|Chemistry|Ken Hirai|K|Ayaka|Angela Aki|Chihiro Onitsuka|Salyu|Chara|Cocco|Sakura Fujiwara|Miyuna|Kaho Nakamura|Miyachi|Friday Night Plans|Lucky Tapes|Suchmos|Never Young Beach|Nulbarich|Tempalay|D.A.N.|Cero|Yogee New Waves|Awesome City Club|Frederic|Pasocom Music Club|Sakanaction|Gen Hoshino|Taisei Miyakawa|Imase|Mega Shinnosuke|Haruno|Chilldspot|Kroi|Indigo La End|Gesu No Kiwami Otome|Ichikoro|Dadaray|KIRINJI|Lamp|Luca|Ichiko Aoba|YeYe|Kaneko Ayano|Satoko Shibata|Predawn|Roth Bart Baron|Kicell|Ohashi Trio|Hanaregumi|Humbert Humbert|Tenniscoats|OGRE YOU ASSHOLE|Downy|Boris|Envy|Lite|Mouse On The Keys|Jizue|Fox Capture Plan|Adam At|SOIL & PIMP SESSIONS|Ego-Wrappin'|PE'Z|Tokyo Ska Paradise Orchestra|The Skatalites|Madness|The Specials|The Selecter|The Beat|The Toasters|Reel Big Fish|Less Than Jake|Streetlight Manifesto|Catch 22|Goldfinger|Sublime|Slightly Stoopid|311|Dirty Heads|Pepper|Rebelution|Iration|Stick Figure|SOJA|The Green|Fortunate Youth|The Movement|J Boog|Katchafire|Fat Freddy's Drop|The Black Seeds|Salmonella Dub|Dub Inc|Groundation|Alborosie|Gentleman|Collie Buddz|Matisyahu|Ott|Shpongle|Younger Brother|Entheogenic|Bluetech|Carbon Based Lifeforms|Solar Fields|AES Dana|H.U.V.A. Network|Delerium|Enigma|Deep Forest|Era|Gregorian|Adiemus|Enya|Loreena McKennitt|Clannad|Celtic Woman|Celtic Thunder|The Corrs|The Cranberries|Sinéad O'Connor|The Pogues|The Dubliners|The Chieftains|The Waterboys|Hozier|Dermot Kennedy|Glen Hansard|The Frames|The Swell Season|Glen Hansard|Damien Dempsey|Christy Moore|Daniel O'Donnell|Van Morrison|Edith Piaf|Scott Walker|Engelbert Humperdinck|Tom Jones|Cliff Richard|Roy Orbison|The Everly Brothers|Buddy Holly|Chuck Berry|Little Richard|Fats Domino|Jerry Lee Lewis|Bo Diddley|Carl Perkins|Gene Vincent|Eddie Cochran|Bill Haley & His Comets|Johnny Cash|Willie Nelson|Waylon Jennings|Kris Kristofferson|Merle Haggard|George Jones|Hank Williams|Hank Williams Jr.|Patsy Cline|Loretta Lynn|Tammy Wynette|Reba McEntire|Wynonna Judd|The Judds|Brooks & Dunn|Alabama|Rascal Flatts|Lady A|Little Big Town|Zac Brown Band|Old Dominion|Dan + Shay|Florida Georgia Line|Sugarland|The Chicks|Darius Rucker|Hootie & The Blowfish|Kip Moore|Brett Young|Brett Eldredge|Thomas Rhett|Dustin Lynch|Cole Swindell|Jordan Davis|Parker McCollum|Cody Johnson|Cody Jinks|Sturgill Simpson|Tyler Childers|Jason Isbell|Margo Price|Ashley McBryde|Carly Pearce|Gabby Barrett|Ingrid Andress|Priscilla Block|Tenille Arts|Tenille Townes|Alana Springsteen|Megan Moroney|Hailey Whitters|Morgan Wade|Kelsea Ballerini|Cassadee Pope|Mickey Guyton|Cam|Lauren Alaina|Maddie & Tae|Runaway June|The Band Perry|Love And Theft|The Civil Wars|The Highwomen|The Secret Sisters|First Aid Kit|Shovels & Rope|The Lone Bellow|Dawes|Lord Huron|The Lumineers|Mumford & Sons|The Head And The Heart|Of Monsters And Men|The Tallest Man On Earth|The Decemberists|The Avett Brothers|The Mountain Goats|The Felice Brothers|The Milk Carton Kids|Punch Brothers|Nickel Creek|Chris Thile|Billy Strings|Molly Tuttle|Sierra Ferrell|Sarah Jarosz|Aoife O'Donovan|Rhiannon Giddens|Carolina Chocolate Drops|Yola|Allison Russell|Ruthie Foster|Valerie June|Adia Victoria|Hurray For The Riff Raff|The War And Treaty|Shakey Graves|Nathaniel Rateliff & The Night Sweats|The Wood Brothers|Trampled By Turtles|Greensky Bluegrass|The Devil Makes Three|Brown Bird|Colter Wall|Charley Crockett|Benjamin Tod|Lost Dog Street Band|Turnpike Troubadours|Whiskey Myers|Blackberry Smoke|The Steel Woods|The Cadillac Three|The Teskey Brothers|The Marcus King Band|Marcus King|Eric Church|Lee Brice|Justin Moore|Brantley Gilbert|Aaron Lewis|Staind|Seether|Shinedown|Godsmack|Volbeat|Alter Bridge|Myles Kennedy|Mark Tremonti|Black Stone Cherry|Theory Of A Deadman|Hinder|Daughtry|Scott Stapp|Aaron Neville|The Neville Brothers|Dr. John|Allen Toussaint|Professor Longhair|Fats Waller|Duke Ellington|Count Basie|Cab Calloway|Dinah Washington|Peggy Lee|Julie London|Blossom Dearie|Chet Baker|Mel Tormé|Bobby Darin|Vic Damone|Johnny Mathis|Andy Williams|Perry Como|Doris Day|Rosemary Clooney|Connie Francis|Brenda Lee|Pat Boone|Paul Anka|Neil Sedaka|Bobby Vinton|Dusty Springfield|Petula Clark|Lulu|Sandie Shaw|Dionne Warwick|Shirley Bassey|Nana Mouskouri|Mireille Mathieu|Vicky Leandros|Demis Roussos|Aphrodite's Child|Boney M.|ABBA|Baccara|Arabesque|Sandra|Modern Talking|Bad Boys Blue|C.C. Catch|Sabrina|Sinitta|Rick Astley|Jason Donovan|Samantha Fox|Kim Wilde|Belinda Carlisle|The Bangles|The Go-Go's|Bananarama|Wilson Phillips|Ace Of Base|Roxette|The Cardigans|A*Teens|Aqua|Vengaboys|Steps|S Club 7|S Club|Sugababes|Atomic Kitten|Girls Aloud|All Saints|Spice Girls|Little Mix|Fifth Harmony|Pussycat Dolls|Danity Kane|Dream|t.A.T.u.|Westlife|Boyzone|Take That|Backstreet Boys|NSYNC|New Kids On The Block|98 Degrees|O-Town|Hanson|The Wanted|Union J|JLS|Busted|McFly|5 Seconds Of Summer|Why Don't We|PRETTYMUCH|Big Time Rush|Jonas Brothers|DNCE|One Direction|Harry Styles|Niall Horan|Louis Tomlinson|Liam Payne|Zayn|Austin Mahone|Jesse McCartney|Shawn Mendes|Justin Bieber|Cody Simpson|Greyson Chance|Shane Filan|Ronan Keating|Robbie Williams|Gary Barlow|Mark Owen|Brian McFadden|Nick Carter|Jordan Knight|Joey McIntyre|Donny Osmond|The Osmonds|Jackson Browne|Jim Croce|Harry Chapin|Gordon Lightfoot|John Denver|Don McLean|Dan Fogelberg|Bread|America|Crosby, Stills & Nash|Crosby, Stills, Nash & Young|Buffalo Springfield|The Hollies|The Mamas & The Papas|The Lovin' Spoonful|The Monkees|The Turtles|The Zombies|The Animals|The Dave Clark Five|Herman's Hermits|Gerry & The Pacemakers|The Searchers|The Spencer Davis Group|Traffic|Blind Faith|Derek & The Dominos|The Allman Brothers Band|Lynyrd Skynyrd|The Marshall Tucker Band|The Doobie Brothers|Little Feat|Grateful Dead|Jefferson Airplane|Jefferson Starship|Starship|Santana|Steve Miller Band|The Guess Who|Bachman-Turner Overdrive|Blue Öyster Cult|Mountain|Grand Funk Railroad|ZZ Top|Cheap Trick|Heart|Pat Benatar|Joan Jett & The Blackhearts|Lita Ford|Vixen|The Runaways|Suzi Quatro|Bonnie Tyler|Meat Loaf|Jim Steinman|Todd Rundgren|Warren Zevon|Randy Newman|Robert Palmer|Joe Cocker|Rod Stewart|Faces|Small Faces|Humble Pie|Steve Marriott|Peter Frampton|Steve Winwood|Paul Weller|The Jam|The Style Council|The Beautiful South|The Housemartins|The Lightning Seeds|The La's|Cast|Ocean Colour Scene|Kula Shaker|Reef|Shed Seven|Supergrass|Sleeper|Elastica|Echobelly|Catatonia|Ash|Feeder|Idlewild|The Coral|The Zutons|Starsailor|Razorlight|The Futureheads|The Wombats|The Vaccines|The Courteeners|Catfish And The Bottlemen|Blossoms|The Lathums|Inhaler|Fontaines D.C.|Idles|Shame|Squid|Black Midi|Black Country, New Road|Dry Cleaning|Yard Act|Viagra Boys|Amyl And The Sniffers|The Chats|Parquet Courts|Protomartyr|Ought|Preoccupations|Women|Iceage|Savages|Jehnny Beth|Priests|Gilla Band|Daughters|Swans|Godspeed You! Black Emperor|A Silver Mt. Zion|Explosions In The Sky|Mogwai|God Is An Astronaut|This Will Destroy You|Russian Circles|Pelican|ISIS|Cult Of Luna|Neurosis|Amenra|Alcest|Deafheaven|Les Discrets|Wolves In The Throne Room|Agalloch|Borknagar|Enslaved|Ulver|Sólstafir|Sigur Ros"""


def norm(value):
    return ''.join(c for c in unicodedata.normalize('NFKD', value).lower() if c.isalnum())


def plain(value):
    return re.sub(r'\s+', ' ', html.unescape(re.sub('<[^>]*>', ' ', value))).strip()


def page(path, params=None):
    global LAST
    url = 'https://music.bugs.co.kr/' + path
    key = re.sub('[^a-zA-Z0-9-]', '_', path + json.dumps(params or {}, sort_keys=True))
    cached = CACHE / (key + '.html')
    if cached.exists() and time.time() - cached.stat().st_mtime < 7 * 86400 and '현재 서비스에 접속하실 수 없습니다' not in cached.read_text():
        return cached.read_text()
    if UNAVAILABLE.is_set():
        raise RuntimeError('Bugs is unavailable; remaining live requests deferred')
    if not hasattr(LOCAL, 'session'):
        LOCAL.session = requests.Session()
    for attempt in range(4):
        # Share the limiter between discovery and profile collection processes.
        with LOCK, open(CACHE / 'requests.lock', 'a+') as pace:
            fcntl.flock(pace, fcntl.LOCK_EX)
            pace.seek(0)
            last = float(pace.read() or '0')
            time.sleep(max(0, .35 - (time.monotonic() - last)))
            pace.seek(0); pace.truncate(); pace.write(str(time.monotonic())); pace.flush()
        response = LOCAL.session.get(url, params=params, timeout=30)
        response.raise_for_status()
        if '현재 서비스에 접속하실 수 없습니다' not in response.text:
            cached.write_text(response.text)
            return response.text
        if attempt < 3:
            time.sleep(20 * (attempt + 1))
    UNAVAILABLE.set()
    raise RuntimeError('Bugs is temporarily unavailable; no error page was accepted as artist data')


def chart(task):
    genre, date = task
    source = page('genre/chart/' + genre + '/total/day', {'date': date})
    result = []
    for attrs, row in re.findall(r'<tr\b([^>]*\btrackId="\d+"[^>]*)>(.*?)</tr>', source, re.S):
        credits = re.search(r'\bartistId="([\d,]+)"', attrs)
        if not credits:
            continue
        for key, name in re.findall(r'href="https://music\.bugs\.co\.kr/artist/(\d+)[^"]*"\s+title="([^"]+)"', row):
            if key in credits[1].split(','):
                result.append({'bugsId': key, 'name': html.unescape(name), 'genre': GENRES[genre]})
    return result


def search(name):
    source = page('search/artist', {'q': name})
    results = []
    for row in re.findall(r'<figure\b[^>]*class="[^"]*\bartistInfo\b[^"]*"[^>]*>(.*?)</figure>', source, re.S):
        key = re.search(r'https://music.bugs.co.kr/artist/(\d+)', row)
        display = re.search(r'class="artistTitle"\s+title="([^"]+)"', row)
        if not key or not display:
            continue
        display = html.unescape(display[1])
        base = re.sub(r'\s*\([^()]*\)\s*$', '', display).strip()
        if norm(name) not in {norm(display), norm(base)}:
            continue
        genre = plain(re.search(r'class="artistGenre">(.*?)</span>', row, re.S)[1]) if 'class="artistGenre">' in row else ''
        mapped = 'hiphop' if re.search('힙합|랩', genre) else 'rock' if re.search('록|락|메탈', genre) else 'rnb' if re.search('알앤비|소울', genre) else 'jazz' if '재즈' in genre else 'folk' if re.search('포크|컨트리|월드', genre) else 'dance'
        results.append({'bugsId': key[1], 'name': display, 'genre': mapped, 'priority': True})
    return results


def profile(candidate):
    key = candidate['bugsId']
    cached = CACHE / ('profile-' + key + '.json')
    if cached.exists() and time.time() - cached.stat().st_mtime < 7 * 86400:
        result = json.loads(cached.read_text())
        result['priority'] = result.get('priority', False) or candidate.get('priority', False)
        return result
    source = page('artist/' + key)
    if f'rel="canonical" href="https://music.bugs.co.kr/artist/{key}"' not in source:
        raise ValueError('Wrong canonical artist profile')
    section = re.search(r'<section\b[^>]*class="[^"]*summaryArtist[^>]*>(.*?)</section>', source, re.S)
    table = re.search(r'<table\b[^>]*class="info"[^>]*>(.*?)</table>', section[1], re.S) if section else None
    info = {plain(k): plain(v) for k, v in re.findall(r'<tr[^>]*>.*?<th[^>]*>(.*?)</th>.*?<td[^>]*>(.*?)</td>.*?</tr>', table[1], re.S)} if table else {}
    country = info.get('국적', '')
    overseas = bool(table and re.search(r'/genre/chart/(?:pop/|etc/(?:njpop|nwpop)/)', table[1]))
    if '대한민국' in country or '한국' in country or (not country and not overseas):
        raise ValueError('Not a verified foreign profile')
    name = re.search(r'<meta\s+property="og:title"\s+content="([^"]+)"', source)
    photo = re.search(r'<li\s+class="big">.*?<img\b[^>]*src="(https://image\.bugsm\.co\.kr/artist/images/[^" ]+)"', section[1], re.S) if section else None
    if not name or not photo:
        raise ValueError('No official profile image')
    name = html.unescape(name[1]).replace("\\'", "'").replace('\\"', '"')
    if re.search(r'various artists|karaoke|tribute|soundalike|piano (?:cover|tribute)|lullaby|music box|relaxing|instrumental versions|cover band|필하모닉|합창단', name, re.I):
        raise ValueError('Compilation or substitute recording artist')
    aliases = []
    alternative = re.search(r'\s*\(([^()]*[가-힣][^()]*)\)\s*$', name)
    if alternative:
        aliases.append(alternative[1]); name = name[:alternative.start()].strip()
    translated = re.search(r'\s*\(([^()]*[가-힣][^()]*)\)\s*$', candidate['name'])
    if translated and norm(candidate['name'][:translated.start()]) == norm(name):
        aliases.append(translated[1])
    # Credited links retain the provider's Korean spelling even when og:title
    # contains only the original stage name. Match the exact canonical ID.
    for display in re.findall(r'href="https://music\.bugs\.co\.kr/artist/' + re.escape(key) + r'[^\"]*"\s+title="([^\"]+)"', source):
        display = html.unescape(display)
        translated = re.search(r'\s*\(([^()]*[가-힣][^()]*)\)\s*$', display)
        if translated and norm(display[:translated.start()]) == norm(name):
            aliases.append(translated[1])
    aliases = list(dict.fromkeys(aliases))
    name = re.sub(r'\s*\([^()]*\)\s*$', '', name).strip() if re.search('[가-힣]', name) else name
    if norm(name) not in {norm(candidate['name']), norm(re.sub(r'\s*\([^()]*\)\s*$', '', candidate['name']))}:
        raise ValueError('Profile name differs from credited candidate')
    refs = []
    for attrs, row in re.findall(r'<tr\b([^>]*\btrackId="\d+"[^>]*)>(.*?)</tr>', source, re.S):
        credits = re.search(r'\bartistId="([\d,]+)"', attrs)
        title = re.search(r'<p\s+class="title"[^>]*>.*?<a\b[^>]*title="([^"]+)"', row, re.S)
        album = re.search(r'<a\b[^>]*class="album"[^>]*title="([^"]+)"', row)
        if credits and key in credits[1].split(',') and title:
            refs.append({'title': html.unescape(title[1]), 'album': html.unescape(album[1]) if album else ''})
    refs = list({norm(s['title']): s for s in refs}.values())
    if len(refs) < 2:
        raise ValueError('Fewer than two distinct credited reference songs')
    kind = info.get('유형', '')
    if not re.search('솔로|그룹|듀오|밴드', kind):
        raise ValueError('Unknown performer type')
    # Provider member composition is evidence; absent composition stays unknown.
    gender = 'mixed' if '혼성' in kind else 'female' if '여성' in kind else 'male' if '남성' in kind else 'unknown'
    slug = re.sub('[^a-z0-9]+', '-', unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode().lower()).strip('-')
    artist_id = 'global-' + (slug or 'bugs-' + key)
    genres = list(dict.fromkeys(candidate.get('genres', [candidate['genre']])))
    artist = {'id': artist_id, 'name': name, 'englishName': name, 'aliases': aliases, 'gender': gender, 'kind': 'solo' if '솔로' in kind else 'group', 'genres': genres, 'source': 'catalog', 'proofSongs': [s['title'] for s in refs[:2]]}
    identity = {'bugsId': key, 'referenceSongs': refs[:30], 'proofSongs': artist['proofSongs']}
    portrait = {'url': re.sub(r'/artist/images/\d+/', '/artist/images/500/', html.unescape(photo[1])), 'pageUrl': f'https://music.bugs.co.kr/artist/{key}', 'title': html.unescape(re.search(r'<meta\s+property="og:title"\s+content="([^"]+)"', source)[1]), 'provider': 'bugs'}
    return {'artist': artist, 'identity': identity, 'portrait': portrait, 'country': country, 'priority': candidate.get('priority', False)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phase', choices=['discover', 'profiles', 'cached'], required=True)
    parser.add_argument('--limit', type=int, default=1400)
    parser.add_argument('--new-only', action='store_true')
    args = parser.parse_args()
    candidates_path = CACHE / 'candidates.json'
    if args.phase == 'discover':
        candidates = {}
        tasks = [(genre, f'{year}{month}15') for genre in GENRES for year in range(2008, 2027, 2) for month in ['03', '09']]
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            for n, result in enumerate(pool.map(chart, tasks)):
                for entry in result:
                    prior = candidates.setdefault(entry['bugsId'], {**entry, 'genres': [], 'appearances': 0})
                    prior['appearances'] += 1
                    if entry['genre'] not in prior['genres']:
                        prior['genres'].append(entry['genre'])
                if n % 30 == 0:
                    print(f'Charts {n+1}/{len(tasks)}: {len(candidates)} artist identities', flush=True)
            names = list(dict.fromkeys(PRIORITY.split('|')))
            for n, result in enumerate(pool.map(search, names)):
                for entry in result:
                    prior = candidates.setdefault(entry['bugsId'], {**entry, 'genres': [entry['genre']], 'appearances': 0})
                    prior['priority'] = True
                    prior['genres'] = [entry['genre']]
                if n % 200 == 0:
                    print(f'Known performers {n+1}/{len(names)}: {len(candidates)} identities', flush=True)
        candidates_path.write_text(json.dumps(list(candidates.values()), ensure_ascii=False, indent=2) + '\n')
    elif args.phase == 'cached':
        # Overseas search records contain the same canonical Bugs ID and
        # official profile photo. Cross-reference them with two independently
        # credited chart recordings when a profile detail page is unavailable.
        # This consumes already-downloaded public pages; it makes no requests.
        references, metadata = {}, {}
        for path in CACHE.glob('genre_chart_*.html'):
            source = path.read_text()
            for attrs, row in re.findall(r'<tr\b([^>]*\btrackId="\d+"[^>]*)>(.*?)</tr>', source, re.S):
                credits = re.search(r'\bartistId="([\d,]+)"', attrs)
                title = re.search(r'<p\s+class="title"[^>]*>.*?<a\b[^>]*title="([^"]+)"', row, re.S)
                album = re.search(r'<a\b[^>]*class="album"[^>]*title="([^"]+)"', row)
                if credits and title and album:
                    for key in credits[1].split(','):
                        references.setdefault(key, {})[norm(html.unescape(title[1]))] = {'title': html.unescape(title[1]), 'album': html.unescape(album[1])}
        for path in CACHE.glob('search_artist_*.html'):
            for row in re.findall(r'<figure\b[^>]*class="[^"]*\bartistInfo\b[^"]*"[^>]*>(.*?)</figure>', path.read_text(), re.S):
                key = re.search(r'https://music.bugs.co.kr/artist/(\d+)', row)
                name = re.search(r'class="artistTitle"\s+title="([^"]+)"', row)
                photo = re.search(r'<img\b[^>]*src="(https://image\.bugsm\.co\.kr/artist/images/[^" ]+)"', row)
                kind = re.search(r'class="artistType">(.*?)</span>', row, re.S)
                if not key or not name or not photo or not kind:
                    continue
                if '/genre/chart/kpop/' in row or not re.search(r'/genre/chart/(?:pop/|etc/(?:njpop|nwpop)/)', row):
                    continue
                metadata[key[1]] = {'name': html.unescape(name[1]).replace("\\'", "'"), 'photo': html.unescape(photo[1]), 'kind': plain(kind[1]), 'row': row}
        existing = json.loads((ROOT / 'src/data/identities.json').read_text())['artists']
        known_ids = {a['bugsId'] for a in existing.values() if a.get('bugsId')}
        added = 0
        for key in references.keys() & metadata.keys():
            if key in known_ids or (CACHE / ('profile-' + key + '.json')).exists():
                continue
            refs = list(references[key].values())
            item = metadata[key]
            name, kind = item['name'], item['kind']
            if len(refs) < 2 or not re.search('솔로|그룹|듀오|밴드', kind) or re.search(r'various artists|karaoke|tribute|soundalike|cover band|필하모닉|합창단', name, re.I):
                continue
            source = CACHE / ('artist_' + key + '__.html')
            if source.exists() and re.search(r'<th[^>]*>국적</th>\s*<td[^>]*>\s*(?:대한민국|한국)', source.read_text()):
                continue
            aliases = []
            alternative = re.search(r'\s*\(([^()]*[가-힣][^()]*)\)\s*$', name)
            if alternative:
                aliases.append(alternative[1]); name = name[:alternative.start()].strip()
            slug = re.sub('[^a-z0-9]+', '-', unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode().lower()).strip('-')
            artist_id = 'global-' + (slug or 'bugs-' + key)
            genres = ['hiphop'] if '/pop/hiphop/' in item['row'] else ['rock'] if re.search('/pop/(?:rock|metal)/', item['row']) else ['rnb'] if '/pop/rnb/' in item['row'] else ['jazz'] if '/pop/jazz/' in item['row'] else ['folk'] if '/etc/nwpop/' in item['row'] else ['dance']
            artist = {'id': artist_id, 'name': name, 'englishName': name, 'aliases': aliases, 'gender': 'mixed' if '혼성' in kind else 'female' if '여성' in kind else 'male' if '남성' in kind else 'unknown', 'kind': 'solo' if '솔로' in kind else 'group', 'genres': genres, 'source': 'catalog', 'proofSongs': [s['title'] for s in refs[:2]]}
            identity = {'bugsId': key, 'referenceSongs': refs[:30], 'proofSongs': artist['proofSongs']}
            portrait = {'url': re.sub(r'/artist/images/\d+/', '/artist/images/500/', item['photo']), 'pageUrl': f'https://music.bugs.co.kr/artist/{key}', 'title': item['name'], 'provider': 'bugs'}
            result = {'artist': artist, 'identity': identity, 'portrait': portrait, 'classification': 'Bugs overseas artist catalog', 'priority': False}
            (CACHE / ('profile-' + key + '.json')).write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
            added += 1
        print(f'{added} additional overseas profiles linked to two distinct credited chart recordings', flush=True)
    else:
        existing = json.loads((ROOT / 'src/data/identities.json').read_text())['artists']
        existing_bugs = {a['bugsId'] for a in existing.values() if a.get('bugsId')}
        candidates = json.loads(candidates_path.read_text())
        candidates = sorted((c for c in candidates if c['bugsId'] not in existing_bugs and (not args.new_only or not (CACHE / ('profile-' + c['bugsId'] + '.json')).exists())), key=lambda c: (not c.get('priority', False), -c['appearances']))[:args.limit]
        results, failures = [], []
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            futures = {pool.submit(profile, c): c for c in candidates}
            for n, future in enumerate(concurrent.futures.as_completed(futures)):
                try:
                    result = future.result()
                    results.append(result)
                    (CACHE / ('profile-' + result['identity']['bugsId'] + '.json')).write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
                except Exception as error:
                    failures.append({'candidate': futures[future], 'error': str(error)})
                if n % 100 == 0:
                    print(f'Profiles {n+1}/{len(candidates)}: {len(results)} foreign profiles, {len(failures)} excluded', flush=True)
        results.sort(key=lambda r: (not r['priority'], norm(r['artist']['name'])))
        (CACHE / 'verified-profiles.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n')
        (CACHE / 'excluded-profiles.json').write_text(json.dumps(failures, ensure_ascii=False, indent=2) + '\n')
        print(f'{len(results)} profiles ready for independent music verification', flush=True)


if __name__ == '__main__':
    main()
