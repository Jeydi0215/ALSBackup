import styles from "../css/History.module.css";
import Filter from "../assets/sort.png";
import Menu from "../assets";
const History = () => {
  return (
    <div className={styles.History}>
      <span className={styles.HistoryText}>Log In History</span>
      <div className={styles.History_inner}>
        <div className={styles.Widget_con}>
          <div className={styles.History_head}>
            <select name="" id="">
              <option value="">Monthly</option>
            </select>

            <div className={styles.History_right}>
              <div className={styles.Filter}>
                <img src={Filter} alt="Filter icon" />
                <span>Filter by date</span>
              </div>
              <button>Generate Report</button>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Clock In</th>
                <th>Break Out</th>
                <th>Break In</th>
                <th>Clock Out</th>
                <th>Working Hours</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>April 01, 2025</td>
                <td>9:30 AM</td>
                <td>12:00 PM</td>
                <td>1:00 PM</td>
                <td>6:33 PM</td>
                <td>8:03 hrs</td>
                <td>
                  <button className={styles.Approved}>Approved</button>
                </td>
              </tr>
              <tr>
                <td>April 02, 2025</td>
                <td>9:30 AM</td>
                <td>12:00 PM</td>
                <td>1:00 PM</td>
                <td>6:33 PM</td>
                <td>8:03 hrs</td>
                <td>
                  <button className={styles.Approved}>Approved</button>
                </td>
              </tr>
              <tr>
                <td>April 03, 2025</td>
                <td>9:30 AM</td>
                <td>12:00 PM</td>
                <td>1:00 PM</td>
                <td>6:33 PM</td>
                <td>8:03 hrs</td>
                <td>
                  <button className={styles.Approved}>Approved</button>
                </td>
              </tr>
              <tr>
                <td>April 04, 2025</td>
                <td>9:30 AM</td>
                <td>12:00 PM</td>
                <td>1:00 PM</td>
                <td>6:33 PM</td>
                <td>8:03 hrs</td>
                <td>
                  <button className={styles.Rejected}>Rejected</button>
                </td>
              </tr>
              <tr>
                <td>April 05, 2025</td>
                <td>9:30 AM</td>
                <td>12:00 PM</td>
                <td>1:00 PM</td>
                <td>6:33 PM</td>
                <td>8:03 hrs</td>
                <td>
                  <button className={styles.Approved}>Approved</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className={styles.pagination}>
          <button>Previous</button>
          <div className={styles.pages}>Page 1 of 10</div>
          <button>Next</button>
        </div>
      </div>
    </div>
  );
};

export default History;
