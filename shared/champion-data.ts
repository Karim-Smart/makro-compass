/**
 * Base de données des champions League of Legends.
 * Utilisée par le moteur macro tips pour les conseils de matchup.
 *
 * Classes : assassin, mage, marksman, bruiser, tank, enchanter, engage, skirmisher
 * Power   : early (fort avant 14min), mid (14-25min), late (25min+), all (toujours fort)
 */

export type ChampionClass = 'assassin' | 'mage' | 'marksman' | 'bruiser' | 'tank' | 'enchanter' | 'engage' | 'skirmisher'
export type PowerCurve = 'early' | 'mid' | 'late' | 'all'

export interface ChampionInfo {
  class: ChampionClass
  power: PowerCurve
  tip: string           // Conseil macro quand tu l'AFFRONTES (1 phrase)
  allyTip?: string      // Conseil quand il est dans TON équipe
  dangerLevel?: number  // 1-3, niveau de menace en lane
}

export const CHAMPIONS: Record<string, ChampionInfo> = {
  // ─── ASSASSINS ──────────────────────────────────────────────────────────────
  'Akali':      { class: 'assassin', power: 'mid', dangerLevel: 3, tip: 'Spike niv 6 — poke-la avant 6, après joue safe et groupe', allyTip: 'Akali peut flank — engage front pour qu\'elle dive les carries' },
  'Akshan':     { class: 'assassin', power: 'mid', dangerLevel: 2, tip: 'Roam constant — ping ses disparitions, ward les flancs', allyTip: 'Son passif de résurrection est énorme — protège-le en fight' },
  'Diana':      { class: 'assassin', power: 'mid', dangerLevel: 2, tip: 'Dangeureuse en multi — ne te groupe pas trop serré (ult AoE)', allyTip: 'Diana veut engager groupé — combo avec des CC AoE' },
  'Ekko':       { class: 'assassin', power: 'mid', dangerLevel: 2, tip: 'Son ult le soigne et il revient — ne le chase pas, prends l\'objectif', allyTip: 'Ekko peut dive safe grâce à son ult — joue agressif' },
  'Evelynn':    { class: 'assassin', power: 'mid', dangerLevel: 3, tip: 'Invisible après 6 — achète des pink wards, ne farm pas seul', allyTip: 'Eve a besoin que tu CC la cible pour combo — hard engage pour elle' },
  'Fizz':       { class: 'assassin', power: 'mid', dangerLevel: 3, tip: 'Spike massif niv 6 — stay loin de lui, respect le requin', allyTip: 'Fizz one-shot les carries — peel-le quand il rentre' },
  'Kassadin':   { class: 'assassin', power: 'late', dangerLevel: 1, tip: 'TRÈS faible avant niv 16 — abuse-le en early, finis avant 30 min', allyTip: 'Kassadin scale — protège-le, joue safe, laisse-le farm' },
  'Katarina':   { class: 'assassin', power: 'mid', dangerLevel: 3, tip: 'Reset de kills — focus-la en premier en teamfight, CC son ult', allyTip: 'Ne kill pas les low HP, laisse Kata reset avec les kills' },
  'Kha\'Zix':   { class: 'assassin', power: 'mid', dangerLevel: 2, tip: 'Dangereux sur cibles isolées — reste TOUJOURS proche d\'un allié', allyTip: 'Kha veut des picks — ward la jungle ennemie pour lui' },
  'LeBlanc':    { class: 'assassin', power: 'mid', dangerLevel: 2, tip: 'Burst rapide mais fragile — CC-la quand elle dash, elle est morte', allyTip: 'LeBlanc domine le mid game — roam avec elle' },
  'Naafiri':    { class: 'assassin', power: 'mid', dangerLevel: 2, tip: 'All-in niv 6 — joue derrière tes minions, elle a besoin de passer à travers', allyTip: 'Naafiri veut des picks en side lane — push les sides pour elle' },
  'Qiyana':     { class: 'assassin', power: 'mid', dangerLevel: 3, tip: 'Ult dévastatrice en jungle/rivière — fight en lane ouverte, pas dans la jungle', allyTip: 'Fight dans la jungle pour maximiser son ult — jeu autour du terrain' },
  'Rengar':     { class: 'assassin', power: 'mid', dangerLevel: 3, tip: 'Un-shot depuis les buissons — ward les buissons, ne face-check jamais', allyTip: 'Rengar a besoin de buissons — fight près de la jungle' },
  'Shaco':      { class: 'assassin', power: 'early', dangerLevel: 2, tip: 'Invade et ganks early — ward TON jungle côté, méfie-toi niv 2-3', allyTip: 'Shaco crée du chaos — profite de la pression qu\'il met' },
  'Talon':      { class: 'assassin', power: 'mid', dangerLevel: 2, tip: 'Roam ultra rapide par-dessus les murs — ping MIA immédiatement', allyTip: 'Talon veut roamer — push ta vague pour qu\'il puisse partir' },
  'Zed':        { class: 'assassin', power: 'mid', dangerLevel: 3, tip: 'Spike niv 6 + Youmuu — garde ton flash pour son ult, ou Zhonya', allyTip: 'Zed split push fort — joue 1-3-1 avec lui' },

  // ─── MAGES ──────────────────────────────────────────────────────────────────
  'Ahri':       { class: 'mage', power: 'mid', dangerLevel: 2, tip: 'Charm (E) = death sentence — dodge latéralement, pas en avant/arrière', allyTip: 'Ahri pick les carries — engage après son charm' },
  'Anivia':     { class: 'mage', power: 'late', dangerLevel: 1, tip: 'Waveclear infinie late game — tu ne peux pas siéger, force Baron', allyTip: 'Anivia zone les objectifs — fight dans les chokepoints pour elle' },
  'Annie':      { class: 'mage', power: 'mid', dangerLevel: 3, tip: 'Flash+ult = AoE stun — track son stun passif (barre violette)', allyTip: 'Annie engage dur — follow son flash engage immédiatement' },
  'Aurelion Sol': { class: 'mage', power: 'late', dangerLevel: 1, tip: 'Scale infiniment — punish son early faible, force les fights tôt', allyTip: 'ASol scale — joue safe, laisse-le farm ses stacks' },
  'Aurora':     { class: 'mage', power: 'mid', dangerLevel: 2, tip: 'Ult emprisonne dans une zone — flash dehors immédiatement', allyTip: 'Aurora zone fort — combo son ult avec des AoE alliés' },
  'Azir':       { class: 'mage', power: 'late', dangerLevel: 1, tip: 'Faible early, monstre late — abuse avant 2 items, finis vite', allyTip: 'Azir a besoin de scaler — protège-le, il carry en late' },
  'Brand':      { class: 'mage', power: 'mid', dangerLevel: 2, tip: 'Dégâts AoE énormes — ne te groupe pas trop serré en fight', allyTip: 'Brand excelle dans les fights groupés — force des 5v5' },
  'Cassiopeia':  { class: 'mage', power: 'late', dangerLevel: 2, tip: 'DPS mage — ne lui tourne pas le dos (ult stun), kite-la', allyTip: 'Cass zone tout — fight dans les corridors pour elle' },
  'Galio':      { class: 'mage', power: 'mid', dangerLevel: 2, tip: 'Ult cross-map — si Galio est MIA, il va ult sur un allié qui dive ta lane', allyTip: 'Dive avec Galio ult — il arrive en renfort, fight 2v1' },
  'Hwei':       { class: 'mage', power: 'mid', dangerLevel: 2, tip: 'Poke longue portée — dodge ses combos, engage au corps à corps', allyTip: 'Hwei zone bien — fight autour des objectifs, il poke le setup' },
  'Lissandra':  { class: 'mage', power: 'mid', dangerLevel: 2, tip: 'Engage + Zhonya — elle veut flash ult sur ton carry, peel-le', allyTip: 'Lissandra engage — follow son ult, tout-in le carry qu\'elle lock' },
  'Lux':        { class: 'mage', power: 'mid', dangerLevel: 2, tip: 'Bind (Q) passe à travers 1 cible — ne te cache pas derrière un seul minion', allyTip: 'Lux poke et protège — joue autour de ses shields et son ult' },
  'Malzahar':   { class: 'mage', power: 'mid', dangerLevel: 2, tip: 'Ult point-and-click suppress — achète QSS, sinon tu es mort', allyTip: 'Malzahar lock une cible — focus la cible qu\'il ult' },
  'Orianna':    { class: 'mage', power: 'mid', dangerLevel: 2, tip: 'Ult AoE dévastatrice — track la balle, ne te regroupe pas autour', allyTip: 'Donne la balle à un engager (Malphite, Wukong) — combo mortel' },
  'Ryze':       { class: 'mage', power: 'late', dangerLevel: 1, tip: 'Faible early, DPS monstrueux late — abuse avant 2 items', allyTip: 'Ryze peut TP l\'équipe avec son ult — follow ses calls' },
  'Smolder':    { class: 'mage', power: 'late', dangerLevel: 1, tip: 'Scale avec les stacks comme Veigar — punish son early pathétique', allyTip: 'Smolder a besoin de 225 stacks — protège-le, il 1v9 en late' },
  'Syndra':     { class: 'mage', power: 'mid', dangerLevel: 3, tip: 'Burst single-target énorme — stay derrière ta frontline, elle one-shot les squishies', allyTip: 'Syndra élimine un carry — peel pour elle en teamfight' },
  'Twisted Fate': { class: 'mage', power: 'mid', dangerLevel: 2, tip: 'Ult = gank global — push ta lane quand il est visible, back si MIA après 6', allyTip: 'TF ult = free kill — setup les lanes pour ses ganks' },
  'Veigar':     { class: 'mage', power: 'late', dangerLevel: 1, tip: 'Scale infiniment — force les fights tôt, finis avant 30 min', allyTip: 'Veigar zone avec sa cage — fight autour d\'elle' },
  'Vel\'Koz':   { class: 'mage', power: 'mid', dangerLevel: 2, tip: 'True damage si 3 stacks — dodge ses skillshots, engage vite', allyTip: 'Vel\'Koz poke le siège — push avec lui, laisse-le poker' },
  'Viktor':     { class: 'mage', power: 'late', dangerLevel: 1, tip: 'Monstre après 3 upgrades — punish son early, il est immobile', allyTip: 'Viktor zone les fights — engage et il clean up derrière' },
  'Vladimir':   { class: 'mage', power: 'late', dangerLevel: 1, tip: 'Pool esquive tout — ne gaspille pas tes CDs, attend qu\'il pool puis engage', allyTip: 'Vlad veut des fights prolongés — engage et il clean avec son ult' },
  'Xerath':     { class: 'mage', power: 'mid', dangerLevel: 1, tip: 'Poke longue portée mais immobile — force l\'engage au corps à corps', allyTip: 'Xerath siège — joue les compos de siège avec lui' },
  'Ziggs':      { class: 'mage', power: 'mid', dangerLevel: 1, tip: 'Waveclear + démolition de tours — force les fights, ne le laisse pas siéger', allyTip: 'Ziggs pousse les tours ultra vite — split avec Baron buff' },
  'Zoe':        { class: 'mage', power: 'mid', dangerLevel: 3, tip: 'Bulle de sommeil = oneshot — dodge la bulle, ne fight pas dans les corridors', allyTip: 'Zoe poke le setup — n\'engage pas avant qu\'elle touche une bulle' },
  'Zyra':       { class: 'mage', power: 'mid', dangerLevel: 2, tip: 'Zone control massive — ne fight pas dans ses plantes, contourne', allyTip: 'Zyra zone le drake/baron pit — fight autour des objectifs' },

  // ─── MARKSMEN (ADC) ─────────────────────────────────────────────────────────
  'Aphelios':   { class: 'marksman', power: 'late', dangerLevel: 1, tip: 'Dépend de ses armes — fight quand il a le fusil rouge (Severum), pas le sniper', allyTip: 'Aphelios monstrueux en late — protège-le à tout prix' },
  'Ashe':       { class: 'marksman', power: 'mid', dangerLevel: 2, tip: 'Flèche globale engage — dodge la flèche, elle est la plus dangereuse au start', allyTip: 'Ashe engage avec la flèche — follow immédiatement' },
  'Caitlyn':    { class: 'marksman', power: 'early', dangerLevel: 2, tip: 'Portée énorme early — joue safe, elle tombe mid game puis remonte late', allyTip: 'Caitlyn siège les tours — joue le push et les plaques' },
  'Draven':     { class: 'marksman', power: 'early', dangerLevel: 3, tip: 'Snowball monstre — ne lui donne PAS de kills early, joue ultra safe', allyTip: 'Draven DOIT snowball — joue autour de lui en bot' },
  'Ezreal':     { class: 'marksman', power: 'mid', dangerLevel: 1, tip: 'Safe et mobile — difficile à tuer, ignore-le et focus les autres', allyTip: 'Ezreal est safe mais besoin de poke — fights prolongés' },
  'Jhin':       { class: 'marksman', power: 'mid', dangerLevel: 2, tip: '4e tir = burst énorme, mais immobile. Engage quand il recharge', allyTip: 'Jhin racine avec W — CC chain après sa root' },
  'Jinx':       { class: 'marksman', power: 'late', dangerLevel: 1, tip: 'Reset passive sur kill = pentakill — focus-la EN PREMIER en teamfight', allyTip: 'Jinx reset — donne-lui le premier kill et elle clean tout' },
  'Kai\'Sa':    { class: 'marksman', power: 'mid', dangerLevel: 2, tip: 'Ult dive les carries — peel ton backline quand elle ult derrière', allyTip: 'Kai\'Sa peut dive avec son ult — CC la cible pour elle' },
  'Kalista':    { class: 'marksman', power: 'early', dangerLevel: 2, tip: 'Kiting pur — les tanks avec hard CC la détruisent, pas de skillshots', allyTip: 'Kalista lance son support — coordinate les engages' },
  'Kog\'Maw':   { class: 'marksman', power: 'late', dangerLevel: 1, tip: 'DPS le plus élevé du jeu late — dive-le ou c\'est perdu, il n\'a pas de dash', allyTip: 'Kog a ZÉRO mobilité — peel-le, il fait le damage' },
  'Lucian':     { class: 'marksman', power: 'early', dangerLevel: 2, tip: 'Fort en early avec un engage support — concède le niv 2 spike si besoin', allyTip: 'Lucian spike tôt — joue agressif bot dès niv 2' },
  'Miss Fortune': { class: 'marksman', power: 'mid', dangerLevel: 2, tip: 'Ult AoE dévastatrice — ne te groupe pas en ligne, CC-la pendant son ult', allyTip: 'MF ult combo avec CC AoE (Amumu, Leona) — force les groupements' },
  'Samira':     { class: 'marksman', power: 'mid', dangerLevel: 3, tip: 'W bloque TOUS les projectiles — n\'utilise pas tes CDs pendant son W', allyTip: 'Samira a besoin de stacker son S — donne-lui des assists pour ult' },
  'Sivir':      { class: 'marksman', power: 'late', dangerLevel: 1, tip: 'Spell shield bloque 1 sort — jette un sort faible d\'abord puis combo', allyTip: 'Sivir ult = engage rapide — run at them quand elle ult' },
  'Tristana':   { class: 'marksman', power: 'early', dangerLevel: 2, tip: 'All-in niv 2-3 très forte — respect sa bombe + jump combo', allyTip: 'Trist pousse les tours ultra vite — joue les plaques avec elle' },
  'Twitch':     { class: 'marksman', power: 'late', dangerLevel: 2, tip: 'Invisible → ult = team wipe — achète des pink wards, groupez', allyTip: 'Twitch veut des flanks — créez du chaos pour son engage invisible' },
  'Varus':      { class: 'marksman', power: 'mid', dangerLevel: 2, tip: 'Ult root se propage — ne reste pas à côté d\'un allié touché par son R', allyTip: 'Varus poke et engage — fight après qu\'il touche son ult' },
  'Vayne':      { class: 'marksman', power: 'late', dangerLevel: 1, tip: 'True damage % HP — les tanks ne peuvent pas la stopper. Burst-la en early', allyTip: 'Vayne 1v9 en late — farm safe, protège-la, elle carry' },
  'Xayah':      { class: 'marksman', power: 'mid', dangerLevel: 2, tip: 'Ult intouchable — attend qu\'elle atterrisse puis engage', allyTip: 'Xayah fait des dégâts massifs dans les choke points — fight dans la jungle' },
  'Zeri':       { class: 'marksman', power: 'late', dangerLevel: 1, tip: 'Ultra mobile en fight — hard CC pour la lock, sinon elle kite tout', allyTip: 'Zeri a besoin de scaler — joue safe, elle carry avec sa mobilité' },

  // ─── BRUISERS / FIGHTERS ────────────────────────────────────────────────────
  'Aatrox':     { class: 'bruiser', power: 'mid', dangerLevel: 2, tip: 'Healing massif avec son ult — achète anti-heal (Grievous Wounds)', allyTip: 'Aatrox veut des teamfights prolongés — fight groupé pour lui' },
  'Ambessa':    { class: 'bruiser', power: 'mid', dangerLevel: 2, tip: 'Très mobile en fight — ne la chase pas, elle te retourne', allyTip: 'Ambessa dive bien — suit son engage sur les carries' },
  'Camille':    { class: 'bruiser', power: 'mid', dangerLevel: 3, tip: 'Ult emprisonne une cible — ne te fais pas isoler, reste groupé', allyTip: 'Camille lock un carry — follow son ult, focus la cible emprisonnée' },
  'Darius':     { class: 'bruiser', power: 'early', dangerLevel: 3, tip: 'Roi du 1v1 niv 1-6 — NE TRADE PAS dans son pull, kite-le', allyTip: 'Darius veut courir sur les gens — peel/ralentis pour qu\'il arrive' },
  'Garen':      { class: 'bruiser', power: 'mid', dangerLevel: 2, tip: 'Silence + ult execute — kite-le, il n\'a pas de gap close fiable', allyTip: 'Garen est inarrêtable avec Deadman\'s — laisse-le flanker' },
  'Gwen':       { class: 'bruiser', power: 'late', dangerLevel: 2, tip: 'W la rend immune aux attaques à distance — fight au corps à corps', allyTip: 'Gwen split push fort — joue 1-3-1 avec elle' },
  'Illaoi':     { class: 'bruiser', power: 'mid', dangerLevel: 2, tip: 'NE COMBATS JAMAIS dans ses tentacules / pendant son ult — recule et re-engage', allyTip: 'Illaoi veut qu\'ils viennent à elle — bait les fights dans sa zone' },
  'Irelia':     { class: 'bruiser', power: 'mid', dangerLevel: 3, tip: 'Stack passive = 5 dashes, elle te détruit. Fight quand son passive est bas', allyTip: 'Irelia dive les carries — elle engage, follow-up immédiatement' },
  'Jax':        { class: 'bruiser', power: 'late', dangerLevel: 2, tip: 'Counter Strike bloque tout auto — utilise tes sorts, pas tes autos, pendant son E', allyTip: 'Jax split push inarrêtable en late — joue 1-3-1' },
  'K\'Sante':   { class: 'bruiser', power: 'mid', dangerLevel: 2, tip: 'Son ult le transforme en assassin — respect quand il ult, il fait mal', allyTip: 'K\'Sante isole une cible avec son ult — focus ce qu\'il push' },
  'Mordekaiser': { class: 'bruiser', power: 'mid', dangerLevel: 2, tip: 'Ult t\'isole en 1v1 — achète QSS pour annuler son ult', allyTip: 'Morde enlève un ennemi du fight — 4v4 pendant son ult' },
  'Nasus':      { class: 'bruiser', power: 'late', dangerLevel: 1, tip: 'Stack infiniment — FREEZE devant ta tour, ne le laisse pas farm tranquille', allyTip: 'Nasus a besoin de stacks — laisse-le farm, il 1v1 tout en late' },
  'Olaf':       { class: 'bruiser', power: 'early', dangerLevel: 3, tip: 'Ult = immun aux CC — ne gaspille pas tes CC pendant son ult, kite-le', allyTip: 'Olaf run-down les carries — laisse-le charger, peel derrière' },
  'Renekton':   { class: 'bruiser', power: 'early', dangerLevel: 3, tip: 'Domine les niveaux 1-9 — concède du CS si nécessaire, il tombe en late', allyTip: 'Renekton engage en stunnant — follow son stun W' },
  'Riven':      { class: 'bruiser', power: 'mid', dangerLevel: 3, tip: 'All-in extrême si fed — track ses CDs, elle est vulnérable entre ses combos', allyTip: 'Riven snowball dur — aide-la à dominer sa lane, roam pour elle' },
  'Sett':       { class: 'bruiser', power: 'early', dangerLevel: 2, tip: 'Son W (bouclier + true damage) est énorme — dodge le centre, fight après', allyTip: 'Sett ult un tank SUR les carries — combo dévastateur en fight' },
  'Urgot':      { class: 'bruiser', power: 'mid', dangerLevel: 2, tip: 'Ult execute sous 25% HP — ne reste JAMAIS low HP face à lui', allyTip: 'Urgot zone bien — fight dans les endroits serrés pour ses jambes' },
  'Volibear':   { class: 'bruiser', power: 'early', dangerLevel: 2, tip: 'Ult tower dive — ne reste pas sous tour low HP, il ignore la tour', allyTip: 'Volibear plonge sous tour — dive avec lui, il tanke la tour' },
  'Wukong':     { class: 'bruiser', power: 'mid', dangerLevel: 2, tip: 'Ult knock-up AoE x2 — ne te regroupe pas trop, il wombo combo', allyTip: 'Wukong ult + Yasuo/Orianna = combo mortel — fight groupé' },
  'Yorick':     { class: 'bruiser', power: 'mid', dangerLevel: 2, tip: 'Split push avec Maiden — ne l\'ignore pas en side lane ou il prend ta base', allyTip: 'Yorick split est inarrêtable — joue 1-4, envoyez-en 2 pour lui' },

  // ─── SKIRMISHERS (duellistes) ───────────────────────────────────────────────
  'Fiora':      { class: 'skirmisher', power: 'late', dangerLevel: 2, tip: 'Riposte bloque TON CC — bait sa W avant d\'utiliser ton CC important', allyTip: 'Fiora split est imbattable en late — joue 1-3-1' },
  'Gangplank':  { class: 'skirmisher', power: 'late', dangerLevel: 1, tip: 'Faible early, monstre en late (barils crit) — punish-le avant 2 items', allyTip: 'GP ult global — il aide les fights cross-map, joue autour' },
  'Graves':     { class: 'skirmisher', power: 'mid', dangerLevel: 2, tip: 'Burst + dash — fight à distance, il est court range', allyTip: 'Graves envahit la jungle ennemie — aide ses invades' },
  'Kindred':    { class: 'skirmisher', power: 'mid', dangerLevel: 2, tip: 'Ult immunise TOUT le monde dans la zone — ne burst pas dedans, attend la fin', allyTip: 'Kindred ult sauve l\'équipe — fight agressivement, elle ult pour sauver' },
  'Lee Sin':    { class: 'skirmisher', power: 'early', dangerLevel: 3, tip: 'Insec (ult kick) = engage mortel — ward derrière toi pour flasher', allyTip: 'Lee Sin fait des picks — joue agressivement autour de ses kicks' },
  'Master Yi':  { class: 'skirmisher', power: 'late', dangerLevel: 1, tip: 'Alpha Strike dodge tout — GARDE ton CC pour quand il sort de son Q', allyTip: 'Yi 1v9 avec resets — protège-le, point-click CC les menaces' },
  'Tryndamere': { class: 'skirmisher', power: 'late', dangerLevel: 2, tip: 'Ult = 5s immortel — disengage quand il ult, re-engage quand ça expire', allyTip: 'Trynd split inarrêtable — joue 1-4, il attire 2 ennemis' },
  'Yasuo':      { class: 'skirmisher', power: 'mid', dangerLevel: 2, tip: 'Windwall bloque les projectiles — ne jette pas tout dans son mur, contourne', allyTip: 'Yasuo ult sur les knock-ups — pick des champions avec knock-up' },
  'Yone':       { class: 'skirmisher', power: 'mid', dangerLevel: 3, tip: 'Ult long range engage — ne te groupe pas en ligne, il engage toute l\'équipe', allyTip: 'Yone engage les teamfights — follow son ult immédiatement' },
  'Viego':      { class: 'skirmisher', power: 'mid', dangerLevel: 2, tip: 'Possède les cadavres — focus-le EN PREMIER, sinon il reset et 1v5', allyTip: 'Viego veut des resets — engage et laisse-le cleanup' },

  // ─── TANKS ──────────────────────────────────────────────────────────────────
  'Amumu':      { class: 'tank', power: 'mid', dangerLevel: 2, tip: 'Ult AoE stun — spread en fight, ne te regroupe pas', allyTip: 'Amumu ult = wombo combo — tout-in quand il engage' },
  'Cho\'Gath':  { class: 'tank', power: 'late', dangerLevel: 1, tip: 'True damage ult qui scale — ne contest pas les smite fights avec lui', allyTip: 'Cho est une montagne en late — il frontline, tu DPS derrière' },
  'Dr. Mundo':  { class: 'tank', power: 'late', dangerLevel: 1, tip: 'Ult régénère tout — achète anti-heal, ignore-le et focus les carries', allyTip: 'Mundo est un mur — laisse-le tank, focus les carries derrière' },
  'Gragas':     { class: 'tank', power: 'mid', dangerLevel: 2, tip: 'Ult déplace toute l\'équipe — attention au positionnement, il sépare les fights', allyTip: 'Gragas ult isole les carries — follow l\'ult immédiatement' },
  'Jarvan IV':  { class: 'tank', power: 'mid', dangerLevel: 2, tip: 'Ult emprisonne — garde ton flash/dash pour sortir de sa cage', allyTip: 'J4 emprisonne les ennemis — AoE dans sa cage' },
  'Malphite':   { class: 'tank', power: 'mid', dangerLevel: 3, tip: 'Ult engage AoE inarrêtable — spread, track son CD (130-80s)', allyTip: 'Malphite ult + follow-up = ace. TOUT LE MONDE suit son ult' },
  'Maokai':     { class: 'tank', power: 'mid', dangerLevel: 1, tip: 'CC infini — il ne te tue pas mais te lock pendant 10 ans. Focus les carries derrière', allyTip: 'Maokai setup la vision — joue les objectifs, il contrôle la rivière' },
  'Ornn':       { class: 'tank', power: 'late', dangerLevel: 2, tip: 'Ult long range engage — dodge le bélier ou flash latéralement', allyTip: 'Ornn upgrade les items de l\'équipe — il scale gratis en late' },
  'Poppy':      { class: 'tank', power: 'mid', dangerLevel: 2, tip: 'Bloque TOUS les dashes avec son W — ne dash pas à travers elle', allyTip: 'Poppy anti-engage — pick-la contre les comps dash (Yasuo, Irelia)' },
  'Rammus':     { class: 'tank', power: 'mid', dangerLevel: 2, tip: 'Taunt + armor vs AD = tu te tues toi-même — build AP/true damage', allyTip: 'Rammus taunt et roule sur les carries — follow sa charge' },
  'Sejuani':    { class: 'tank', power: 'mid', dangerLevel: 2, tip: 'Ult AoE stun massif — spread et dodge, gros CD après', allyTip: 'Sejuani engage fort — follow son ult, fight 5v5' },
  'Shen':       { class: 'tank', power: 'mid', dangerLevel: 2, tip: 'Ult global protège un allié — ping quand il channel, c\'est 2v1 garanti', allyTip: 'Shen ult save les dives — dive agressivement, il TP sur toi' },
  'Tahm Kench': { class: 'tank', power: 'early', dangerLevel: 2, tip: 'Avale les alliés pour les sauver — ne focus pas la cible qu\'il avale', allyTip: 'TK peut te sauver en t\'avalant — joue agressif près de lui' },
  'Zac':        { class: 'tank', power: 'mid', dangerLevel: 2, tip: 'Engage long range depuis la jungle — ward les couloirs, il jump de loin', allyTip: 'Zac engage de très loin — follow ses jumps, fight immédiat' },

  // ─── ENCHANTERS ─────────────────────────────────────────────────────────────
  'Janna':      { class: 'enchanter', power: 'mid', dangerLevel: 1, tip: 'Ult repousse et heal — n\'engage pas dans son ult, tu perds tout', allyTip: 'Janna peel incroyable — joue derrière elle, elle protège le carry' },
  'Karma':      { class: 'enchanter', power: 'early', dangerLevel: 1, tip: 'Forte en early, bouclier de vitesse — elle tombe en late game', allyTip: 'Karma accélère l\'équipe — engage ou disengage rapide avec son E' },
  'Lulu':       { class: 'enchanter', power: 'late', dangerLevel: 1, tip: 'Polymorph neutralise les assassins — pick burst ou poke', allyTip: 'Lulu + hyper carry = inarrêtable. Protège le carry avec elle' },
  'Millio':     { class: 'enchanter', power: 'mid', dangerLevel: 1, tip: 'Cleanse tout le CC avec son ult — chain tes CC, ne CC pas en même temps', allyTip: 'Milio cleanse le CC — engage même si vous êtes CC, il sauve' },
  'Nami':       { class: 'enchanter', power: 'mid', dangerLevel: 1, tip: 'Bulle + ult = beaucoup de CC — dodge latéralement, ne fais pas face', allyTip: 'Nami buff les autos avec E — joue avec l\'ADC, combo autoattack' },
  'Renata Glasc': { class: 'enchanter', power: 'mid', dangerLevel: 2, tip: 'Ult force les ennemis à se taper entre eux — spread, ne te groupe pas', allyTip: 'Renata ult zone les fights — fight dans les corridors' },
  'Sona':       { class: 'enchanter', power: 'late', dangerLevel: 1, tip: 'Faible early — abuse-la en lane, elle scale en monstre', allyTip: 'Sona scale — protège-la, son aura late game est dévastatrice' },
  'Soraka':     { class: 'enchanter', power: 'mid', dangerLevel: 1, tip: 'Heal global ult — achète anti-heal (Grievous Wounds) en priorité', allyTip: 'Soraka maintient l\'équipe en vie — fight prolongé, elle out-sustain' },
  'Yuumi':      { class: 'enchanter', power: 'late', dangerLevel: 1, tip: 'Attachée au carry = invulnérable — focus le champion sur lequel elle est', allyTip: 'Yuumi sur le carry fed = inarrêtable. Feed le meilleur joueur' },

  // ─── ENGAGE SUPPORTS ────────────────────────────────────────────────────────
  'Alistar':    { class: 'engage', power: 'mid', dangerLevel: 2, tip: 'Headbutt-Pulverize combo = engage instantané — stay derrière les minions', allyTip: 'Alistar engage dur — follow immédiatement son combo' },
  'Blitzcrank': { class: 'engage', power: 'mid', dangerLevel: 3, tip: 'UN hook = un mort. Stay derrière les minions, TOUJOURS', allyTip: 'Blitz hook = free kill. Follow chaque hook immédiatement' },
  'Braum':      { class: 'engage', power: 'mid', dangerLevel: 2, tip: 'Bouclier bloque le premier projectile — ne jette pas ton skillshot clé en premier', allyTip: 'Braum passive stun — auto-attaque la cible qu\'il marque' },
  'Leona':      { class: 'engage', power: 'mid', dangerLevel: 3, tip: 'Engage niv 2-3 = kill assuré en 2v2. Respect son niv 2 spike', allyTip: 'Leona engage → follow IMMÉDIATEMENT, elle lock la cible 3s' },
  'Nautilus':   { class: 'engage', power: 'mid', dangerLevel: 3, tip: 'Hook + ult point-and-click — stay behind minions, respect ses all-in', allyTip: 'Nautilus = CC machine. Follow ses engages, la cible ne peut pas bouger' },
  'Pyke':       { class: 'engage', power: 'mid', dangerLevel: 3, tip: 'Ult execute et reset — ne reste JAMAIS low HP, back immédiatement', allyTip: 'Pyke partage l\'or des kills — laisse-le exécuter avec son ult' },
  'Rakan':      { class: 'engage', power: 'mid', dangerLevel: 2, tip: 'Dash + ult charm AoE = engage instantané — spread pour minimiser l\'impact', allyTip: 'Rakan engage ultra vite — follow son ult charm immédiatement' },
  'Rell':       { class: 'engage', power: 'mid', dangerLevel: 2, tip: 'W crash = AoE knock-up — ne te regroupe pas, elle engage multiple', allyTip: 'Rell engage AoE — combo avec des AoE (MF, Jinx, Brand)' },
  'Thresh':     { class: 'engage', power: 'all', dangerLevel: 3, tip: 'Hook + lanterne = engage + renfort. Ward les flancs, son jungler arrive par la lanterne', allyTip: 'Thresh lanterne = taxi. Click la lanterne pour les engages/escapes' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getChampion(name: string): ChampionInfo | null {
  // Recherche exacte puis insensible à la casse
  if (CHAMPIONS[name]) return CHAMPIONS[name]
  const key = Object.keys(CHAMPIONS).find(
    (k) => k.toLowerCase() === name.toLowerCase()
  )
  return key ? CHAMPIONS[key] : null
}

/**
 * Retourne le conseil de matchup quand tu affrontes ce champion.
 */
export function getMatchupTip(enemyName: string): string | null {
  return getChampion(enemyName)?.tip ?? null
}

/**
 * Retourne le conseil quand ce champion est dans ton équipe.
 */
export function getAllyTip(allyName: string): string | null {
  return getChampion(allyName)?.allyTip ?? null
}

// ─── Class vs Class matchup rules ─────────────────────────────────────────────

export interface ClassMatchupRule {
  text: string
  priority: 'low' | 'medium' | 'high'
}

const CLASS_VS_CLASS: Record<string, ClassMatchupRule> = {
  // Format: "myClass_vs_enemyClass"
  'assassin_vs_mage':      { text: 'Tu as le burst avantage — all-in après qu\'il rate un skillshot', priority: 'medium' },
  'assassin_vs_tank':      { text: 'Tu ne peux pas tuer un tank — ignore-le, roam et kill les squishies', priority: 'medium' },
  'assassin_vs_bruiser':   { text: 'Bruiser te bat en trade long — short trade seulement, in-out rapide', priority: 'medium' },
  'assassin_vs_marksman':  { text: 'Tu one-shot l\'ADC — flank par derrière ou attend qu\'il gaspille son dash', priority: 'medium' },
  'mage_vs_assassin':      { text: 'L\'assassin te cible — joue safe, ward, reste sous tour. Rush Zhonya', priority: 'high' },
  'mage_vs_tank':          { text: 'Le tank ne te tue pas mais te zone — poke-le de loin, ne te fais pas engage', priority: 'low' },
  'mage_vs_bruiser':       { text: 'Le bruiser veut te gap-close — garde ta distance et ton CC défensif', priority: 'medium' },
  'marksman_vs_assassin':  { text: 'L\'assassin te cible — reste derrière ta frontline, garde ton flash', priority: 'high' },
  'marksman_vs_tank':      { text: 'Kite le tank — ne le focus pas en premier, il veut te zone', priority: 'medium' },
  'marksman_vs_bruiser':   { text: 'Le bruiser veut te run down — kite-le avec ton range, CC et peel', priority: 'medium' },
  'bruiser_vs_tank':       { text: 'Trade long = tu gagnes. Les bruisers ont le sustained damage vs tanks', priority: 'low' },
  'bruiser_vs_marksman':   { text: 'Gap-close l\'ADC — il ne peut pas te kite si tu es sur lui', priority: 'medium' },
  'bruiser_vs_mage':       { text: 'Force l\'engage — les mages sont fragiles au corps à corps', priority: 'medium' },
  'tank_vs_assassin':      { text: 'L\'assassin ne peut pas te burst — peel pour tes carries, ignore-le', priority: 'low' },
  'tank_vs_marksman':      { text: 'L\'ADC te kite — utilise tes CC pour le lock, ne le chase pas seul', priority: 'medium' },
  'tank_vs_bruiser':       { text: 'Le bruiser te bat en 1v1 — ne 1v1 pas, groupe avec ton équipe', priority: 'medium' },
  'skirmisher_vs_tank':    { text: 'Tu gagnes les trades longs — force les trades soutenus', priority: 'low' },
  'skirmisher_vs_mage':    { text: 'Engage au CàC — les mages sont faibles sans CDs', priority: 'medium' },
  'skirmisher_vs_assassin': { text: 'Duel 50/50 — celui qui utilise mieux ses CDs gagne', priority: 'low' },
  'skirmisher_vs_bruiser': { text: 'Matchup de duel — joue autour de tes spikes de niveaux', priority: 'low' },
}

/**
 * Retourne un conseil de matchup basé sur la classe du joueur vs la classe ennemie.
 */
export function getClassMatchup(myChampion: string, enemyChampion: string): ClassMatchupRule | null {
  const me = getChampion(myChampion)
  const enemy = getChampion(enemyChampion)
  if (!me || !enemy) return null

  const key = `${me.class}_vs_${enemy.class}`
  return CLASS_VS_CLASS[key] ?? null
}

/**
 * Analyse la composition ennemie et retourne des conseils macro.
 */
export function analyzeEnemyComp(enemies: string[]): string[] {
  const tips: string[] = []
  const classes = enemies.map((e) => getChampion(e)?.class).filter(Boolean) as ChampionClass[]

  const assassins = classes.filter((c) => c === 'assassin').length
  const tanks = classes.filter((c) => c === 'tank' || c === 'engage').length
  const enchanters = classes.filter((c) => c === 'enchanter').length
  const marksmen = classes.filter((c) => c === 'marksman').length
  const lateScalers = enemies.filter((e) => getChampion(e)?.power === 'late').length
  const earlyChamps = enemies.filter((e) => getChampion(e)?.power === 'early').length

  if (assassins >= 2) tips.push('⚠️ 2+ assassins ennemis — groupe, ne farm pas seul, vision défensive')
  if (tanks >= 3) tips.push('🛡️ Comp ennemie tanky — build anti-tank (% HP, pénétration), fights longs')
  if (enchanters >= 2) tips.push('💊 Beaucoup de heal ennemi — achète Grievous Wounds en priorité')
  if (lateScalers >= 3) tips.push('⏰ L\'ennemi scale tard — FORCE les fights maintenant, finis avant 30 min')
  if (earlyChamps >= 3) tips.push('🕐 L\'ennemi est fort en early — joue safe, scale, ils tombent après 25 min')
  if (marksmen >= 2) tips.push('🏹 2 ADC ennemis — build armor, engage sur eux, ils sont squishies')

  return tips
}
