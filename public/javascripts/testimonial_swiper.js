



$(".testimonial-reel").slick({
    centerMode: true,
    centerPadding: "40px",
    dots: false,
    slidesToShow: 3,
    infinite: true,
    arrows: false,
    lazyLoad: "ondemand",
    autoplay: false, 
    responsive: [
        {
            breakpoint: 1024,
            settings: {
                slidesToShow: 2,
                centerMode: false
            }
        },
        {
            breakpoint: 767,
            settings: {
                slidesToShow: 1
            }
        }
    ]
});
