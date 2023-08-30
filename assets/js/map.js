(function () {
  var FRIDAY_DAY_NUMBER = 5;

  function modulo(a, b) {
    return ((a % b) + b) % b;
  }

  /** The closest Friday (today or the coming) */
  function fridayAsMillis() {
    var today = new Date();
    var currentDayOfWeek = today.getDay();
    var daysToAdd = modulo(5 - currentDayOfWeek, 7);
    var friday = new Date(today.getTime() + daysToAdd * 24 * 3600 * 1000);
    friday.setHours(9);
    friday.setMinutes(0);
    friday.setSeconds(0);

    return friday.getTime();
  }

  // for some reason, this is one hour off on Google. At least in the winter ...
  function googleOsloEggedalTripUrl() {
    return (
      "https://www.google.com/maps/dir/Oslo+Sentralstasjon,+Jernbanetorget,+Oslo/Eggedal+kirke,+Fv287+40,+3359+Eggedal/@59.9906977,9.4960455,9z/data=!3m1!4b1!4m18!4m17!1m5!1m1!1s0x46416e8a1c253d39:0x6d69efbe96e850d2!2m2!1d10.7524574!2d59.911096!1m5!1m1!1s0x4640895733640047:0x8e0529bcae65fadf!2m2!1d9.3571665!2d60.2462148!2m3!6e0!7e2!8j" +
      Math.round(fridayAsMillis() / 1000) +
      "!3e3"
    );
  }

  function enturOsloEggedalTripUrl() {
    return (
      "https://entur.no/travel-result?date=" +
      fridayAsMillis() +
      "&transportModes=bus%2Ctram%2Crail%2Cmetro%2Cwater%2Cair%2Cflytog%2Cflybuss&walkSpeed=1.3&minimumTransferTime=120&timepickerMode=departAfter&startId=NSR%3AGroupOfStopPlaces%3A1&startLabel=Oslo&startLat=59.911379&startLon=10.747898&stopId=NSR%3AStopPlace%3A16233&stopLabel=Eggedal%20sentrum%2C%20Sigdal&stopLat=60.246522&stopLon=9.356017"
    );
  }

  var enturLink = document.getElementById("entur-lazy-link");
  if (enturLink) {
    enturLink.href = enturOsloEggedalTripUrl();
  } else {
    console.warn("Could not locate link for EnTur");
  }

  var googleLink = document.getElementById("google-lazy-link");
  if (googleLink) {
    googleLink.href = googleOsloEggedalTripUrl();
  } else {
    console.warn("Could not locate link for Google Maps");
  }
})();
