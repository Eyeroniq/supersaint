import { ANNOUNCEMENTS } from "../../config/site";

// Continuously scrolling strip; the list is rendered twice so the loop is seamless
const AnnouncementBar = () => {
  const items = [...ANNOUNCEMENTS, ...ANNOUNCEMENTS, ...ANNOUNCEMENTS];
  return (
    <div className="announcement" role="region" aria-label="Announcements">
      <div className="announcement__track">
        {[0, 1].map((copy) => (
          <div className="announcement__group" key={copy} aria-hidden={copy === 1}>
            {items.map((text, i) => (
              <span key={i}>{text}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AnnouncementBar;
