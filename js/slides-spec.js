define({
	theme:      { module: 'css!themes/black/theme.css' },
	transition: { module: 'css!themes/fade.css' },
    model: {
	     create: {
             module: 'hc/slides/SingleFilePresentationModel',
             args: { $ref: 'slidePath' }
	     }
     },
     view: {
         create: {
             module: 'hc/slides/SlideView',
             args: [{ $ref: 'slideContainer' }, { $ref: 'model' }]
         }
     },
     controller: {
         create: {
             module: 'hc/slides/PresentationController',
             args: { $ref: 'view' }
         }
     }
});