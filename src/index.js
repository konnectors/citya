const {
  BaseKonnector,
  requestFactory,
  signin,
  saveFiles,
  log
} = require('cozy-konnector-libs')

const request = requestFactory({
  // the debug mode shows all the details about http request and responses. Very useful for
  // debugging but very verbose. That is why it is commented out by default
  // debug: true,
  // activates [cheerio](https://cheerio.js.org/) parsing on each page
  cheerio: true,
  // If cheerio is activated do not forget to deactivate json parsing (which is activated by
  // default in cozy-konnector-libs
  json: false,
  // this allows request-promise to keep cookies between requests
  jar: true
})

const baseUrl = 'https://my.citya.com/V5/'
var $
module.exports = new BaseKonnector(start)

// The start function is run by the BaseKonnector instance only when it got all the account
// information (fields). When you run this connector yourself in "standalone" mode or "dev" mode,
// the account information come from ./konnector-dev-config.json file
async function start(fields) {
  log('info', 'Authenticating ...')
  await authenticate(fields.login, fields.password)
  log('info', 'Successfully logged in')
  // The BaseKonnector instance expects a Promise as return of the function
  log('info', 'Fetching the list of documents')
  $ = await request(`${baseUrl}/documents.html`)
  // cheerio (https://cheerio.js.org/) uses the same api as jQuery (http://jquery.com/)
  log('info', 'Parsing list of documents')
  const documents = await parseDocuments($)

  log('info', 'Save data to Cozy')
  await saveFiles(documents, fields, {
    timeout: Date.now() + 300 * 1000
  })
}

// this shows authentication using the [signin function](https://github.com/konnectors/libs/blob/master/packages/cozy-konnector-libs/docs/api.md#module_signin)
// even if this in another domain here, but it works as an example
function authenticate(username, password) {
  return signin({
    url: `https://www.citya.com/mycitya`,
    formSelector: 'form[name=i_citya_login]',
    formData: {
      login: username,
      mdp: password,
      groupe: 'citya'
    },
    // the validate function will check if the login request was a success. Every website has
    // different ways respond: http status code, error message in html ($), http redirection
    // (fullResponse.request.uri.href)...
    validate: (statusCode, $) => {
      // The login in toscrape.com always works excepted when no password is set
      if ($(`a[href='deconnexion-citya.html']`).length >= 1) {
        return true
      } else {
        // cozy-konnector-libs has its own logging function which format these logs with colors in
        // standalone and dev mode and as JSON in production mode
        log('error', $('.error').text())
        return false
      }
    }
  })
}

// The goal of this function is to parse a html page wrapped by a cheerio instance
// and return an array of js objects which will be saved to the cozy by saveBills (https://github.com/konnectors/libs/blob/master/packages/cozy-konnector-libs/docs/api.md#savebills)
async function parseDocuments($) {
  // Il faut recuperer les liens
  var tabLiens = $('.text-box>a')
  var docs = []
  for (var i = 0; i < tabLiens.length; i++) {
    // Fait la requete
    $ = await request(baseUrl + '/' + tabLiens[i].attribs.href)

    // Recupere les documents de la page
    var documents = parseDocuments_page($)
    docs.push(...documents)
    // pour l'instant on ne fait pas les documents du syndic
    // voir la fonction parseDocuments_syndic pour 'comment il faudrait faire'
    break
  }

  return docs
}

function parseDocuments_page($) {
  var tabLiens = $('.ged-blockquote>a')

  log('info', 'Nombre de liens : ' + tabLiens.length)
  var docs = []
  for (var i = 0; i < tabLiens.length; i++) {
    var oLien = tabLiens[i]

    var sTitre = oLien.children[1].children[2].data
    sTitre = sTitre.trim()

    var sFileURL = baseUrl + '/' + oLien.attribs.href
    var sDate = dateFromTitle(sTitre)

    var sFileName = getParamFromQueryString(sFileURL, 'file')

    log('info', 'sTitre : ' + sTitre)
    log('info', 'sFileURL : ' + sFileURL)
    log('info', 'sDate : ' + sDate)
    log('info', 'sFileName : ' + sFileName)

    docs.push({
      title: sTitre,
      fileurl: sFileURL,
      date: sDate,
      filename: sFileName
    })
  }

  return docs
}

function getParamFromQueryString(sURL, sParam) {
  var tabParams = sURL.split('?')
  tabParams = tabParams[1].split('&')
  for (var i = 0; i < tabParams.length; i++) {
    var tabParam = tabParams[i].split('=')
    if (tabParam[0] == sParam) return tabParam[1]
  }
  return ''
}

// convert a price string to a float
function dateFromTitle(sTitre) {
  // titre :  Appels de fonds du 01 01 2019
  var regex = /([0-9]{2,4})/g
  var found = sTitre.match(regex)

  return new Date(found[2] + '-' + found[1] + '-' + found[0])
}

//function parseDocuments_syndic($) {
// Selecteur des divs dossier : "div[id^='dossier-']",
// Chargement du contenu (il faut que ca soit recursif (ca peut renvoyer des sous dossier)
// ca renvoie soit des divs avec  le meme fonctionnement, soit des liens de la forme :
/*
 <a href="download.php?file=0028_CONVOC_AG_2018_11_26.pdf&chemin=Zdna0ceblpSUZ5OaYph1qMN8g5OTenplusHiYSmeImrtIaVp6iSk2JlncN6sLCJiHfApYCPlmRoaJhkZsJpa5DVnJw&crypt=on" class="nodecoration">
                  <div class="ged-blockquoteOFF">
                  	                 		<img src="img/ged/pdf.png" class="ged-icon" /> 0028 CONVOC AG 2018 11 26.pdf                  	                  </div>
                  </a> 
				  				  
                  <a href="download.php?file=0028_CONVOC_AGC_2017_09_25.pdf&chemin=Zdna0ceblpSUZ5OaYph1qMN8g5OTenplusHiYSmeImrtIaVp6iSk2JlncN6sLCJiHfApYBzw2ZnYXCSZZyWZ5eTqJrM&crypt=on" class="nodecoration">
                  <div class="ged-blockquoteOFF">
                  	                 		<img src="img/ged/pdf.png" class="ged-icon" /> 0028 CONVOC AGC 2017 09 25.pdf                  	                  </div>
                  </a> 
				  				  
                  <a href="download.php?file=0028_CONVOC_AGC_2017_07_20.pdf&chemin=Zdna0ceblpSUZ5OaYph1qMN8g5OTenplusHiYSmeImrtIaVp6iSk2JlncN6sLCJiHfApYBzw2ZnYXCSZZqWZ5KTqJrM&crypt=on" class="nodecoration">
                  <div class="ged-blockquoteOFF">
                  	                 		<img src="img/ged/pdf.png" class="ged-icon" /> 0028 CONVOC AGC 2017 07 20.pdf                  	                  </div>
                  </a> 
				  



/*		var tab_id = $(this).attr("id").split("-");
		var id_dossier = tab_id[1];
		var nom_dossier = tab_id[2];
		var iiii = tab_id[3];
		var cccc = tab_id[4];
		var mmmm = tab_id[5];
		var llll = tab_id[6];
		var xxxx = tab_id[7];
		var path = tab_id[8];



			if(nom_dossier) {
				$.ajax({
					type: "POST",
					url: "php/sous_dossier.php",
					data: {
						nom_dossier: nom_dossier,
						iiii: iiii,
						cccc: cccc,
						mmmm: mmmm,
						llll: llll,
						xxxx: xxxx,
						path: path
					},
					success: function (retour) {
						$("#sousdossier-" + id_dossier).html(retour);
					}
				});
			}


*/
//}
