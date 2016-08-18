window.onload = function () {
  var url, 
      i,
      jqxhr;

  for (i = 0; i < 2; i++) {
    url = document.URL + 'inputs/' + i;
    jqxhr = $.getJSON(url, function(data) {
      console.log('API response received');
      $('#input').append('<p>input gpio port ' + data['gpio'] + ' on pin ' +
        data['pin'] + ' has current value ' + data['value'] + '</p>');
    });
  }
};

$(document).ready(function(){
    $("#btnPush").click(function(){
        $.ajax({url: "http://192.168.1.3/led", success: function(result){
            console.log("success");
        }});
    });
});
